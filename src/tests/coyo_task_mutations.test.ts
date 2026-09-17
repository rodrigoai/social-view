/** @jest-environment node */
import { DELETE, GET, PATCH } from '@/app/api/coyo/tasks/[id]/route';
import { DELETE as DELETE_ATTACHMENT } from '@/app/api/coyo/tasks/[id]/attachments/[fileId]/route';
import { requireMainAccountAccess, AuthzError } from '@/lib/authz';
import { addCoyoTaskCommentForAccount, deleteCoyoBacklogTaskForAccount, fetchCoyoTaskDetailForAccount, removeCoyoBacklogAttachmentForAccount, updateCoyoBacklogTaskForAccount } from '@/lib/coyoTasksServer';

jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/authz', () => ({ ...jest.requireActual('@/lib/authz'), requireMainAccountAccess: jest.fn() }));
jest.mock('@/lib/coyoTasksServer', () => ({
  CoyoTasksError: class CoyoTasksError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } },
  updateCoyoBacklogTaskForAccount: jest.fn(),
  fetchCoyoTaskDetailForAccount: jest.fn(),
  addCoyoTaskCommentForAccount: jest.fn(),
  deleteCoyoBacklogTaskForAccount: jest.fn(),
  removeCoyoBacklogAttachmentForAccount: jest.fn(),
}));

const context = { params: Promise.resolve({ id: 'task-1' }) };

beforeEach(() => {
  jest.clearAllMocks();
  (requireMainAccountAccess as jest.Mock).mockResolvedValue({ id: 'user-1', name: 'Social User', email: 'social@example.com' });
});

it('returns scoped task detail with comments and history', async () => {
  const task = { id: 'task-1', comments: [], history: [] };
  (fetchCoyoTaskDetailForAccount as jest.Mock).mockResolvedValue(task);
  const response = await GET(new Request('http://localhost/api/coyo/tasks/task-1?mainAccountId=account-1'), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ task });
  expect(fetchCoyoTaskDetailForAccount).toHaveBeenCalledWith('account-1', 'task-1');
});

it('forwards a comment-only patch and preserves its distinct response shape', async () => {
  const comment = { id: 'comment-1', content: '<p>Looks good.</p>', author: { id: 'user-1', name: 'Ana' }, createdAt: '2026-09-16T12:00:00Z' };
  (addCoyoTaskCommentForAccount as jest.Mock).mockResolvedValue(comment);
  const response = await PATCH(new Request('http://localhost/api/coyo/tasks/task-1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mainAccountId: 'account-1', comment: ' Looks good. ' }),
  }), context);
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ comment });
  expect(addCoyoTaskCommentForAccount).toHaveBeenCalledWith('account-1', 'task-1', 'Looks good.', 'Social User');
  expect(updateCoyoBacklogTaskForAccount).not.toHaveBeenCalled();
});

it('validates and forwards Backlog task updates', async () => {
  (updateCoyoBacklogTaskForAccount as jest.Mock).mockResolvedValue({ id: 'task-1', title: 'Updated title', status: 'BACKLOG' });
  const response = await PATCH(new Request('http://localhost/api/coyo/tasks/task-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mainAccountId: 'account-1', title: ' Updated title ', description: ' Copy ', dueDate: '', workspace: 'agency' }),
  }), context);
  expect(response.status).toBe(200);
  expect(updateCoyoBacklogTaskForAccount).toHaveBeenCalledWith('account-1', 'task-1', { title: 'Updated title', description: 'Copy', dueDate: null, workspace: 'AGENCY', attachments: [] });
});

it('accepts new attachments in multipart Backlog task updates', async () => {
  (updateCoyoBacklogTaskForAccount as jest.Mock).mockResolvedValue({ id: 'task-1', title: 'Updated title', status: 'BACKLOG' });
  const body = new FormData();
  body.set('mainAccountId', 'account-1');
  body.set('title', 'Updated title');
  body.set('description', 'Copy');
  body.set('dueDate', '2026-09-30');
  body.set('workspace', 'SOFTWARE');
  body.append('attachments', new File(['new artwork'], 'artwork.png', { type: 'image/png' }));

  const response = await PATCH(new Request('http://localhost/api/coyo/tasks/task-1', { method: 'PATCH', body }), context);

  expect(response.status).toBe(200);
  const input = (updateCoyoBacklogTaskForAccount as jest.Mock).mock.calls[0][2];
  expect(input).toEqual(expect.objectContaining({ title: 'Updated title', description: 'Copy', dueDate: '2026-09-30', workspace: 'SOFTWARE' }));
  expect(input.attachments).toHaveLength(1);
  expect(input.attachments[0].name).toBe('artwork.png');
});

it('requires account access before deletion', async () => {
  (requireMainAccountAccess as jest.Mock).mockRejectedValue(new AuthzError('Forbidden', 403));
  const response = await DELETE(new Request('http://localhost/api/coyo/tasks/task-1?mainAccountId=account-1', { method: 'DELETE' }), context);
  expect(response.status).toBe(403);
  expect(deleteCoyoBacklogTaskForAccount).not.toHaveBeenCalled();
});

it('returns 204 after permanent deletion', async () => {
  (deleteCoyoBacklogTaskForAccount as jest.Mock).mockResolvedValue(undefined);
  const response = await DELETE(new Request('http://localhost/api/coyo/tasks/task-1?mainAccountId=account-1', { method: 'DELETE' }), context);
  expect(response.status).toBe(204);
  expect(deleteCoyoBacklogTaskForAccount).toHaveBeenCalledWith('account-1', 'task-1');
});

it('removes one scoped Backlog attachment', async () => {
  (removeCoyoBacklogAttachmentForAccount as jest.Mock).mockResolvedValue({ id: 'task-1', status: 'BACKLOG' });
  const response = await DELETE_ATTACHMENT(
    new Request('http://localhost/api/coyo/tasks/task-1/attachments/image_1?mainAccountId=account-1', { method: 'DELETE' }),
    { params: Promise.resolve({ id: 'task-1', fileId: 'image_1' }) },
  );
  expect(response.status).toBe(200);
  expect(removeCoyoBacklogAttachmentForAccount).toHaveBeenCalledWith('account-1', 'task-1', 'image_1');
});
