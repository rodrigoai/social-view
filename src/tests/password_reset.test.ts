/**
 * @jest-environment node
 */
import { POST } from '@/app/api/auth/forgot-password/route';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

describe('Forgot password API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-temporary-password');
    (sendEmail as jest.Mock).mockResolvedValue(undefined);
    (prisma.user.update as jest.Mock).mockResolvedValue({});
  });

  it('resets an active user password and emails the temporary password', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'client@example.com',
      status: 'ACTIVE',
    });

    const response = await POST(new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: ' Client@Example.COM ' }),
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'client@example.com' },
      select: { id: true, email: true, status: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordHash: 'hashed-temporary-password',
        sessionVersion: { increment: 1 },
      },
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'client@example.com',
      subject: 'Your SocialView temporary password',
    }));
  });

  it('does not reveal unknown emails', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'missing@example.com' }),
    }));

    expect(response.status).toBe(200);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
