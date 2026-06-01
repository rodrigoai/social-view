/**
 * @jest-environment node
 */
import { PATCH } from '@/app/api/users/[id]/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('User management API', () => {
  let tx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1', role: 'CLIENT', status: 'DISABLED' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-1', role: 'CLIENT', status: 'DISABLED' }),
      },
      clientMainAccountAccess: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'CLIENT', status: 'ACTIVE' });
    (prisma.user.count as jest.Mock).mockResolvedValue(1);
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));
  });

  it('disables a user and increments their session version', async () => {
    const request = new Request('http://localhost/api/users/user-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DISABLED' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'user-1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.user).toMatchObject({ id: 'user-1', status: 'DISABLED' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: {
        status: 'DISABLED',
        sessionVersion: { increment: 1 },
      },
    }));
  });

  it('prevents disabling the last active admin', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    (prisma.user.count as jest.Mock).mockResolvedValue(0);

    const request = new Request('http://localhost/api/users/admin-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DISABLED' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'admin-1' }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('At least one active admin is required');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
