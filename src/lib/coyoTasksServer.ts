import { Readable } from 'node:stream';
import { prisma } from '@/lib/prisma';
import { coyoAttachmentMarkup, extractGoogleDriveFileId, removeCoyoAttachmentMarkup, taskAttachmentLinks, type CoyoComment, type CoyoTask, type CoyoTaskDetail } from '@/lib/coyoTasks';
import { getConfiguredGoogleDriveClient } from '@/lib/googleDriveServiceAccount';

export class CoyoTasksError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export type NewCoyoTaskInput = {
  title: string;
  description?: string;
  dueDate?: string;
  workspace: 'AGENCY' | 'SOFTWARE';
  attachments: File[];
};

export type UpdateCoyoTaskInput = {
  title: string;
  description: string;
  dueDate: string | null;
  workspace: 'AGENCY' | 'SOFTWARE';
  attachments?: File[];
};

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

function escapeDriveQuery(value: string) { return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'"); }
function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }

async function getCoyoAccountConfig(mainAccountId: string) {
  const account = await prisma.mainAccount.findUnique({
    where: { id: mainAccountId },
    select: { coyoClientAcronym: true, coyoTaskManagerKey: true },
  });
  if (!account?.coyoClientAcronym) throw new CoyoTasksError('Configure this customer’s Coyô client prefix in Settings.', 400);
  const token = account.coyoTaskManagerKey;
  const origin = process.env.COYO_EXTERNAL_API_ORIGIN;
  if (!token || !origin) throw new CoyoTasksError('Coyô API token and registered Origin must be configured on the server.', 503);
  return { clientAcronym: account.coyoClientAcronym, token, origin };
}

export async function fetchCoyoTasksForAccount(mainAccountId: string) {
  const { clientAcronym, token, origin } = await getCoyoAccountConfig(mainAccountId);

  const url = new URL('https://taskmanager.coyo.com.br/api/external/tasks');
  url.searchParams.set('clientAcronym', clientAcronym);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Origin: origin, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const message = response.status === 403 ? 'Coyô rejected the registered Origin. Check the server configuration.'
      : response.status === 401 ? 'Coyô rejected the API token.'
      : response.status === 400 ? 'Coyô rejected the customer prefix. Check Settings.'
      : 'Coyô TaskManager is unavailable. Please try again.';
    throw new CoyoTasksError(message, 502);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new CoyoTasksError('Coyô returned an invalid task response.', 502);
  return payload.filter((task: CoyoTask) => task.client?.prefix?.toLowerCase() === clientAcronym.toLowerCase()) as CoyoTask[];
}

export async function fetchCoyoTaskDetailForAccount(mainAccountId: string, taskId: string) {
  const { clientAcronym, token, origin } = await getCoyoAccountConfig(mainAccountId);
  const response = await fetch(`https://taskmanager.coyo.com.br/api/external/tasks/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${token}`, Origin: origin, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw await taskMutationError(response);
  const task = await response.json();
  if (!task?.id || task.id !== taskId || !Array.isArray(task.comments) || !Array.isArray(task.history)) {
    throw new CoyoTasksError('Coyô returned an invalid task detail response.', 502);
  }
  if (task.client?.prefix?.toLowerCase() !== clientAcronym.toLowerCase()) {
    throw new CoyoTasksError('Task not found for this client.', 404);
  }
  return task as CoyoTaskDetail;
}

export async function addCoyoTaskCommentForAccount(mainAccountId: string, taskId: string, comment: string, externalAuthor: string) {
  const task = await fetchCoyoTaskDetailForAccount(mainAccountId, taskId);
  const { token, origin } = await getCoyoAccountConfig(mainAccountId);
  const response = await fetch(`https://taskmanager.coyo.com.br/api/external/tasks/${encodeURIComponent(task.id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, Origin: origin, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment, externalAuthor }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw await taskMutationError(response);
  const created = await response.json();
  const validAuthor = created?.author === null || (typeof created?.author?.name === 'string' && created.author.name.length > 0);
  if (!created?.id || typeof created.content !== 'string' || !validAuthor || !created.createdAt) {
    throw new CoyoTasksError('Coyô returned an invalid comment response.', 502);
  }
  return created as CoyoComment;
}

export async function createCoyoTaskForAccount(mainAccountId: string, input: NewCoyoTaskInput) {
  const { clientAcronym, token, origin } = await getCoyoAccountConfig(mainAccountId);
  const body = new FormData();
  body.set('title', input.title);
  body.set('clientAcronym', clientAcronym);
  if (input.description) body.set('description', input.description);
  if (input.dueDate) body.set('dueDate', input.dueDate);
  body.set('workspace', input.workspace);
  input.attachments.forEach(file => body.append('attachments', file, file.name));

  const response = await fetch('https://taskmanager.coyo.com.br/api/external/tasks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Origin: origin, Accept: 'application/json' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const serviceError = payload && typeof payload.error === 'string' ? payload.error : '';
    const message = response.status === 403 ? 'Coyô rejected the registered Origin. Check the server configuration.'
      : response.status === 401 ? 'Coyô rejected the API token.'
      : response.status === 400 && serviceError ? serviceError
      : 'Coyô TaskManager is unavailable. Please try again.';
    throw new CoyoTasksError(message, response.status === 400 ? 400 : 502);
  }
  if (!payload?.id || !payload?.displayId || payload.status !== 'BACKLOG') {
    throw new CoyoTasksError('Coyô returned an invalid task response.', 502);
  }
  return payload;
}

async function requireScopedBacklogTask(mainAccountId: string, taskId: string) {
  const tasks = await fetchCoyoTasksForAccount(mainAccountId);
  const task = tasks.find(item => item.id === taskId);
  if (!task) throw new CoyoTasksError('Task not found for this client.', 404);
  if (task.status !== 'BACKLOG') throw new CoyoTasksError('Only Backlog tasks can be changed from SocialView.', 409);
  return task;
}

async function taskMutationError(response: Response) {
  const payload = await response.json().catch(() => null);
  const serviceError = payload && typeof payload.error === 'string' ? payload.error : '';
  const message = response.status === 403 ? 'Coyô rejected the registered Origin. Check the server configuration.'
    : response.status === 401 ? 'Coyô rejected the API token.'
    : (response.status === 400 || response.status === 404) && serviceError ? serviceError
    : 'Coyô TaskManager is unavailable. Please try again.';
  return new CoyoTasksError(message, response.status === 400 || response.status === 404 ? response.status : 502);
}

async function patchCoyoTask(taskId: string, token: string, origin: string, fields: Record<string, unknown>) {
  const response = await fetch(`https://taskmanager.coyo.com.br/api/external/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, Origin: origin, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw await taskMutationError(response);
  const task = await response.json();
  if (!task?.id || task.id !== taskId) throw new CoyoTasksError('Coyô returned an invalid task response.', 502);
  return task as CoyoTask;
}

async function findAttachmentFolder(task: CoyoTask, drive: Awaited<ReturnType<typeof getConfiguredGoogleDriveClient>>) {
  const existingFileId = taskAttachmentLinks(task).map(extractGoogleDriveFileId).find((id): id is string => Boolean(id));
  if (existingFileId) {
    const response = await drive.files.get({ fileId: existingFileId, fields: 'parents', supportsAllDrives: true });
    if (response.data.parents?.[0]) return response.data.parents[0];
  }

  const taskFolder = await drive.files.list({
    q: `name = '${escapeDriveQuery(task.displayId)}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`,
    fields: 'files(id,name)', pageSize: 10, spaces: 'drive', corpora: 'allDrives', supportsAllDrives: true, includeItemsFromAllDrives: true,
  });
  if (taskFolder.data.files?.[0]?.id) return taskFolder.data.files[0].id;

  const roots = await drive.files.list({
    q: `name = 'TaskAttachments' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`,
    fields: 'files(id,name)', pageSize: 10, spaces: 'drive', corpora: 'allDrives', supportsAllDrives: true, includeItemsFromAllDrives: true,
  });
  const rootId = roots.data.files?.[0]?.id;
  if (!rootId) throw new CoyoTasksError('The Coyô TaskAttachments folder is not available to SocialView.', 503);
  const created = await drive.files.create({ requestBody: { name: task.displayId, mimeType: FOLDER_MIME_TYPE, parents: [rootId] }, fields: 'id', supportsAllDrives: true });
  if (!created.data.id) throw new CoyoTasksError('Unable to create this task’s attachment folder.', 502);
  return created.data.id;
}

type UploadedAttachment = { id: string; name: string; mimeType: string };

async function trashFiles(drive: Awaited<ReturnType<typeof getConfiguredGoogleDriveClient>>, fileIds: string[], trashed = true) {
  await Promise.allSettled(fileIds.map(fileId => drive.files.update({ fileId, requestBody: { trashed }, supportsAllDrives: true })));
}

async function uploadAttachments(task: CoyoTask, files: File[]) {
  if (!files.length) return { drive: null, uploaded: [] as UploadedAttachment[] };
  const drive = await getConfiguredGoogleDriveClient();
  const folderId = await findAttachmentFolder(task, drive);
  const uploaded: UploadedAttachment[] = [];
  try {
    for (const file of files) {
      const response = await drive.files.create({
        requestBody: { name: file.name, parents: [folderId] },
        media: { mimeType: file.type || 'application/octet-stream', body: Readable.from(Buffer.from(await file.arrayBuffer())) },
        fields: 'id,name,mimeType', supportsAllDrives: true,
      });
      if (!response.data.id) throw new Error('DRIVE_UPLOAD_FAILED');
      uploaded.push({ id: response.data.id, name: response.data.name || file.name, mimeType: response.data.mimeType || file.type || 'application/octet-stream' });
    }
    return { drive, uploaded };
  } catch (error) {
    await trashFiles(drive, uploaded.map(file => file.id));
    throw error;
  }
}

function attachmentMarkup(files: UploadedAttachment[]) {
  return files.map(file => {
    const url = `/api/drive/media?fileId=${encodeURIComponent(file.id)}`;
    return file.mimeType.startsWith('image/') ? `<img src="${url}" alt="${escapeHtml(file.name)}">` : `<a href="${url}">${escapeHtml(file.name)}</a>`;
  }).join('\n');
}

export async function updateCoyoBacklogTaskForAccount(mainAccountId: string, taskId: string, input: UpdateCoyoTaskInput) {
  const currentTask = await requireScopedBacklogTask(mainAccountId, taskId);
  if (taskAttachmentLinks(currentTask).length + (input.attachments?.length || 0) > 10) throw new CoyoTasksError('A task can contain up to 10 attachments.', 400);
  const { token, origin } = await getCoyoAccountConfig(mainAccountId);
  const { drive, uploaded } = await uploadAttachments(currentTask, input.attachments || []);
  const existingMarkup = coyoAttachmentMarkup(currentTask.description);
  const description = [input.description, existingMarkup, attachmentMarkup(uploaded)].filter(Boolean).join('\n');
  try {
    return await patchCoyoTask(taskId, token, origin, { title: input.title, description, dueDate: input.dueDate, workspace: input.workspace });
  } catch (error) {
    if (drive) await trashFiles(drive, uploaded.map(file => file.id));
    throw error;
  }
}

export async function removeCoyoBacklogAttachmentForAccount(mainAccountId: string, taskId: string, fileId: string) {
  const currentTask = await requireScopedBacklogTask(mainAccountId, taskId);
  const linkedFileIds = taskAttachmentLinks(currentTask).map(extractGoogleDriveFileId).filter((id): id is string => Boolean(id));
  if (!linkedFileIds.includes(fileId)) throw new CoyoTasksError('Attachment not found for this task.', 404);
  const { token, origin } = await getCoyoAccountConfig(mainAccountId);
  const drive = await getConfiguredGoogleDriveClient();
  const metadata = await drive.files.get({ fileId, fields: 'trashed,capabilities(canTrash)', supportsAllDrives: true });
  if (metadata.data.trashed) throw new CoyoTasksError('Attachment not found for this task.', 404);
  if (metadata.data.capabilities?.canTrash === false) throw new CoyoTasksError('SocialView cannot remove this Drive attachment.', 403);
  await drive.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true });
  try {
    return await patchCoyoTask(taskId, token, origin, { description: removeCoyoAttachmentMarkup(currentTask.description, fileId) });
  } catch (error) {
    await trashFiles(drive, [fileId], false);
    throw error;
  }
}

export async function deleteCoyoBacklogTaskForAccount(mainAccountId: string, taskId: string) {
  await requireScopedBacklogTask(mainAccountId, taskId);
  const { token, origin } = await getCoyoAccountConfig(mainAccountId);
  const response = await fetch(`https://taskmanager.coyo.com.br/api/external/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Origin: origin, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw await taskMutationError(response);
}
