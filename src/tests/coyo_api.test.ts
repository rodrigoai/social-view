/** @jest-environment node */
import { GET } from '@/app/api/coyo/tasks/route';
import { prisma } from '@/lib/prisma';
import { requireMainAccountAccess, AuthzError } from '@/lib/authz';
jest.mock('@/lib/prisma', () => ({ prisma: { mainAccount: { findUnique: jest.fn() } } }));
jest.mock('@/lib/authz', () => ({ ...jest.requireActual('@/lib/authz'), requireMainAccountAccess: jest.fn() }));
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
