import { prisma } from '@/lib/prisma';
import { coyoAttachmentMarkup, type CoyoTask } from '@/lib/coyoTasks';

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
};

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

export async function updateCoyoBacklogTaskForAccount(mainAccountId: string, taskId: string, input: UpdateCoyoTaskInput) {
  const currentTask = await requireScopedBacklogTask(mainAccountId, taskId);
  const { token, origin } = await getCoyoAccountConfig(mainAccountId);
  const attachmentMarkup = coyoAttachmentMarkup(currentTask.description);
  const description = [input.description, attachmentMarkup].filter(Boolean).join('\n');
  const response = await fetch(`https://taskmanager.coyo.com.br/api/external/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, Origin: origin, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: input.title, description, dueDate: input.dueDate, workspace: input.workspace }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw await taskMutationError(response);
  const task = await response.json();
  if (!task?.id || task.id !== taskId) throw new CoyoTasksError('Coyô returned an invalid task response.', 502);
  return task as CoyoTask;
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
