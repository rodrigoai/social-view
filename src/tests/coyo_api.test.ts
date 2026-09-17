/** @jest-environment node */
import { GET, POST } from '@/app/api/coyo/tasks/route';
import { prisma } from '@/lib/prisma';
import { requireMainAccountAccess, AuthzError } from '@/lib/authz';
import { addCoyoTaskCommentForAccount, deleteCoyoBacklogTaskForAccount, fetchCoyoTaskDetailForAccount, removeCoyoBacklogAttachmentForAccount, updateCoyoBacklogTaskForAccount } from '@/lib/coyoTasksServer';
import { getConfiguredGoogleDriveClient } from '@/lib/googleDriveServiceAccount';
jest.mock('@/lib/prisma', () => ({ prisma: { mainAccount: { findUnique: jest.fn() } } }));
jest.mock('@/lib/authz', () => ({ ...jest.requireActual('@/lib/authz'), requireMainAccountAccess: jest.fn() }));
jest.mock('@/lib/googleDriveServiceAccount', () => ({ getConfiguredGoogleDriveClient: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  process.env.COYO_EXTERNAL_API_ORIGIN = 'https://example.com';
  (requireMainAccountAccess as jest.Mock).mockResolvedValue({});
  (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ coyoClientAcronym: 'AC', coyoTaskManagerKey: 'secret' });
});
it('authorizes the selected account before reading configuration', async () => {
  (requireMainAccountAccess as jest.Mock).mockRejectedValue(new AuthzError('Forbidden', 403));
  expect((await GET(new Request('http://localhost/api/coyo/tasks?mainAccountId=1'))).status).toBe(403);
  expect(prisma.mainAccount.findUnique).not.toHaveBeenCalled();
});
it('uses account key, explicit origin and client scope, excluding other customers', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{ id: '1', client: { prefix: 'AC' } }, { id: '2', client: { prefix: 'OTHER' } }] });
  const response = await GET(new Request('http://localhost/api/coyo/tasks?mainAccountId=1&clientAcronym=OTHER'));
  expect(await response.json()).toEqual({ tasks: [{ id: '1', client: { prefix: 'AC' } }] });
  expect(global.fetch).toHaveBeenCalledWith(new URL('https://taskmanager.coyo.com.br/api/external/tasks?clientAcronym=AC'), expect.objectContaining({ headers: { Authorization: 'Bearer secret', Origin: 'https://example.com', Accept: 'application/json' } }));
});
it('does not query all customers when configuration is missing', async () => {
  (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({});
  expect((await GET(new Request('http://localhost/api/coyo/tasks?mainAccountId=1'))).status).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});
it('does not retry rejected authentication', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });
  expect((await GET(new Request('http://localhost/api/coyo/tasks?mainAccountId=1'))).status).toBe(502);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('reads scoped detail and posts a comment with the external API contract', async () => {
  const detail = { id: 'task-1', client: { prefix: 'AC' }, comments: [], history: [] };
  const comment = { id: 'comment-1', content: '<p>Ready.</p>', author: { id: 'user-1', name: 'Ana' }, createdAt: '2026-09-16T12:00:00Z' };
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => detail })
    .mockResolvedValueOnce({ ok: true, json: async () => detail })
    .mockResolvedValueOnce({ ok: true, json: async () => comment });

  await expect(fetchCoyoTaskDetailForAccount('1', 'task-1')).resolves.toEqual(detail);
  await expect(addCoyoTaskCommentForAccount('1', 'task-1', 'Ready.', 'Social User')).resolves.toEqual(comment);
  const [url, options] = (global.fetch as jest.Mock).mock.calls[2];
  expect(url).toBe('https://taskmanager.coyo.com.br/api/external/tasks/task-1');
  expect(options).toEqual(expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ Authorization: 'Bearer secret', Origin: 'https://example.com', 'Content-Type': 'application/json' }) }));
  expect(JSON.parse(options.body)).toEqual({ comment: 'Ready.', externalAuthor: 'Social User' });
});

it('rejects detail from a different Coyô client', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: 'task-1', client: { prefix: 'OTHER' }, comments: [], history: [] }) });
  await expect(fetchCoyoTaskDetailForAccount('1', 'task-1')).rejects.toMatchObject({ status: 404 });
});

it('creates a scoped Backlog task with every supported field', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ id: 'task-1', displayId: 'AC-42', status: 'BACKLOG', attachments: [] }),
  });
  const form = new FormData();
  form.set('mainAccountId', '1');
  form.set('title', 'Campaign brief');
  form.set('description', 'Prepare the campaign assets.');
  form.set('dueDate', '2026-09-30');
  form.set('workspace', 'software');
  form.append('attachments', new File(['brief'], 'brief.txt', { type: 'text/plain' }));

  const response = await POST(new Request('http://localhost/api/coyo/tasks', { method: 'POST', body: form }));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ task: { id: 'task-1', displayId: 'AC-42', status: 'BACKLOG', attachments: [] } });
  const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
  const sent = options.body as FormData;
  expect(url).toBe('https://taskmanager.coyo.com.br/api/external/tasks');
  expect(options).toEqual(expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer secret', Origin: 'https://example.com', Accept: 'application/json' } }));
  expect(Object.fromEntries([...sent.entries()].filter(([key]) => key !== 'attachments'))).toEqual({ title: 'Campaign brief', clientAcronym: 'AC', description: 'Prepare the campaign assets.', dueDate: '2026-09-30', workspace: 'SOFTWARE' });
  expect((sent.get('attachments') as File).name).toBe('brief.txt');
});

it('authorizes before creating and rejects unsupported workspace values', async () => {
  const unauthorized = new FormData();
  unauthorized.set('mainAccountId', '1');
  unauthorized.set('title', 'Private task');
  (requireMainAccountAccess as jest.Mock).mockRejectedValueOnce(new AuthzError('Forbidden', 403));
  expect((await POST(new Request('http://localhost/api/coyo/tasks', { method: 'POST', body: unauthorized }))).status).toBe(403);

  (requireMainAccountAccess as jest.Mock).mockResolvedValueOnce({});
  const invalid = new FormData();
  invalid.set('mainAccountId', '1');
  invalid.set('title', 'Invalid task');
  invalid.set('workspace', 'SOCIAL');
  const response = await POST(new Request('http://localhost/api/coyo/tasks', { method: 'POST', body: invalid }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Workspace must be AGENCY or SOFTWARE.' });
  expect(global.fetch).not.toHaveBeenCalled();
});

it('rejects attachments larger than the application 5 MB limit', async () => {
  const form = new FormData();
  form.set('mainAccountId', '1');
  form.set('title', 'Large attachment');
  form.append('attachments', new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.bin'));
  const response = await POST(new Request('http://localhost/api/coyo/tasks', { method: 'POST', body: form }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'large.bin exceeds the 5 MB attachment limit.' });
  expect(global.fetch).not.toHaveBeenCalled();
});

it('updates a scoped Backlog task and preserves its attachment markup', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'task-1', status: 'BACKLOG', client: { prefix: 'AC' }, description: '<p>Old copy</p><a href="/api/drive/media?fileId=brief_1">brief.pdf</a>' }] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'task-1', status: 'BACKLOG', title: 'Updated title' }) });

  await expect(updateCoyoBacklogTaskForAccount('1', 'task-1', { title: 'Updated title', description: 'New copy', dueDate: '2026-10-01', workspace: 'SOFTWARE' })).resolves.toEqual(expect.objectContaining({ id: 'task-1', title: 'Updated title' }));
  const [url, options] = (global.fetch as jest.Mock).mock.calls[1];
  expect(url).toBe('https://taskmanager.coyo.com.br/api/external/tasks/task-1');
  expect(options.method).toBe('PATCH');
  expect(JSON.parse(options.body)).toEqual({ title: 'Updated title', description: 'New copy\n<a href="/api/drive/media?fileId=brief_1">brief.pdf</a>', dueDate: '2026-10-01', workspace: 'SOFTWARE' });
});

it('uploads new edit attachments to the task folder and appends their markup', async () => {
  const drive = { files: {
    get: jest.fn().mockResolvedValue({ data: { parents: ['task-folder'] } }),
    create: jest.fn().mockResolvedValue({ data: { id: 'image_2', name: 'new.png', mimeType: 'image/png' } }),
    update: jest.fn(),
  } };
  (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue(drive);
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'task-1', displayId: 'AC-42', status: 'BACKLOG', client: { prefix: 'AC' }, description: '<p>Copy</p><img src="/api/drive/media?fileId=image_1">' }] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'task-1', status: 'BACKLOG' }) });

  await updateCoyoBacklogTaskForAccount('1', 'task-1', {
    title: 'Updated', description: 'Copy', dueDate: null, workspace: 'AGENCY',
    attachments: [new File(['pixels'], 'new.png', { type: 'image/png' })],
  });

  expect(drive.files.get).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'image_1' }));
  expect(drive.files.create).toHaveBeenCalledWith(expect.objectContaining({ requestBody: { name: 'new.png', parents: ['task-folder'] } }));
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).description).toBe('Copy\n<img src="/api/drive/media?fileId=image_1">\n<img src="/api/drive/media?fileId=image_2" alt="new.png">');
});

it('moves a selected attachment to Drive trash and removes only its task markup', async () => {
  const drive = { files: {
    get: jest.fn().mockResolvedValue({ data: { trashed: false, capabilities: { canTrash: true } } }),
    update: jest.fn().mockResolvedValue({ data: {} }),
  } };
  (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue(drive);
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'task-1', displayId: 'AC-42', status: 'BACKLOG', client: { prefix: 'AC' }, description: '<p>Copy</p><img src="/api/drive/media?fileId=image_1"><a href="/api/drive/media?fileId=brief_2">brief.pdf</a>' }] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'task-1', status: 'BACKLOG' }) });

  await removeCoyoBacklogAttachmentForAccount('1', 'task-1', 'image_1');

  expect(drive.files.update).toHaveBeenCalledWith({ fileId: 'image_1', requestBody: { trashed: true }, supportsAllDrives: true });
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toEqual({ description: '<p>Copy</p><a href="/api/drive/media?fileId=brief_2">brief.pdf</a>' });
});

it('deletes a scoped Backlog task but blocks mutations after it leaves Backlog', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'task-1', status: 'BACKLOG', client: { prefix: 'AC' } }] })
    .mockResolvedValueOnce({ ok: true, status: 204 });
  await expect(deleteCoyoBacklogTaskForAccount('1', 'task-1')).resolves.toBeUndefined();
  expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('https://taskmanager.coyo.com.br/api/external/tasks/task-1');
  expect((global.fetch as jest.Mock).mock.calls[1][1].method).toBe('DELETE');

  (global.fetch as jest.Mock).mockReset().mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'task-2', status: 'IN_PROGRESS', client: { prefix: 'AC' } }] });
  await expect(deleteCoyoBacklogTaskForAccount('1', 'task-2')).rejects.toMatchObject({ status: 409 });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
