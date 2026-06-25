import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function createTemporaryPassword() {
  return randomBytes(9).toString('base64url');
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ ok: true });
    }

    const temporaryPassword = createTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await sendEmail({
      to: user.email,
      subject: 'Your SocialView temporary password',
      text: [
        'A password reset was requested for your SocialView account.',
        '',
        `Temporary password: ${temporaryPassword}`,
        '',
        'Sign in with this temporary password and ask an administrator to set a new password if needed.',
      ].join('\n'),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === 'EMAIL_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'Password reset email is not configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
