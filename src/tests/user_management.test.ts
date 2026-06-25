/**
 * @jest-environment node
 */
import { DELETE, PATCH } from '@/app/api/users/[id]/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
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
    (prisma.user.delete as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
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

  it('updates user profile fields and password', async () => {
    const request = new Request('http://localhost/api/users/user-1', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Updated User',
        email: ' Updated@Example.COM ',
        password: 'new-password',
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'user-1' }) });

    expect(response.status).toBe(200);
    expect(bcrypt.hash).toHaveBeenCalledWith('new-password', 12);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: {
        name: 'Updated User',
        email: 'updated@example.com',
        passwordHash: 'hashed-password',
        sessionVersion: { increment: 1 },
      },
    }));
  });

  it('deletes a user', async () => {
    const response = await DELETE(new Request('http://localhost/api/users/user-1'), {
      params: Promise.resolve({ id: 'user-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true },
    });
  });

  it('prevents deleting the last active admin', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    (prisma.user.count as jest.Mock).mockResolvedValue(0);

    const response = await DELETE(new Request('http://localhost/api/users/admin-1'), {
      params: Promise.resolve({ id: 'admin-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('At least one active admin is required');
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
