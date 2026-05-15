/**
 * @jest-environment node
 */
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireMainAccountAccess, requireUser } from '@/lib/authz';
import { GET as getAccounts } from '@/app/api/accounts/route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    clientMainAccountAccess: {
      findUnique: jest.fn(),
    },
    mainAccount: {
      findMany: jest.fn(),
    },
  },
}));

const activeAdmin = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  sessionVersion: 1,
};

const activeClient = {
  id: 'client-1',
  email: 'client@example.com',
  name: 'Client',
  role: 'CLIENT',
  status: 'ACTIVE',
  sessionVersion: 1,
};

function mockSession(user = activeAdmin) {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      sessionVersion: user.sessionVersion,
    },
  });
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
}

describe('app auth authorization', () => {
  const previousEnforce = process.env.ENFORCE_AUTH_TESTS;

  beforeEach(() => {
    process.env.ENFORCE_AUTH_TESTS = 'true';
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.ENFORCE_AUTH_TESTS = previousEnforce;
  });

  it('allows active admins to use admin-only operations', async () => {
    mockSession(activeAdmin);

    await expect(requireAdmin()).resolves.toMatchObject({ id: activeAdmin.id, role: 'ADMIN' });
  });

  it('rejects disabled users even when they still have a session', async () => {
    mockSession({ ...activeClient, status: 'DISABLED' });

    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it('allows clients to access assigned main accounts', async () => {
    mockSession(activeClient);
    (prisma.clientMainAccountAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });

    await expect(requireMainAccountAccess('main-1')).resolves.toMatchObject({ id: activeClient.id });
  });

  it('rejects clients from unassigned main accounts', async () => {
    mockSession(activeClient);
    (prisma.clientMainAccountAccess.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(requireMainAccountAccess('main-2')).rejects.toMatchObject({ status: 403 });
  });

  it('filters /api/accounts by client account access', async () => {
    mockSession(activeClient);
    const accounts = [{ id: 'main-1', name: 'Allowed' }];
    (prisma.mainAccount.findMany as jest.Mock).mockResolvedValue(accounts);

    const response = await getAccounts();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.accounts).toEqual(accounts);
    expect(prisma.mainAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        clientAccesses: {
          some: { userId: activeClient.id },
        },
      },
    }));
  });
});
