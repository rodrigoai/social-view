import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

export class AuthzError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type AuthzUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

function allowTestAdmin() {
  return process.env.NODE_ENV === 'test' && process.env.ENFORCE_AUTH_TESTS !== 'true';
}

export async function requireUser(): Promise<AuthzUser> {
  if (allowTestAdmin()) {
    return { id: 'test-admin', email: 'admin@example.com', name: 'Test Admin', role: 'ADMIN' };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AuthzError('Unauthorized', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      sessionVersion: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new AuthzError('Unauthorized', 401);
  }

  if (user.sessionVersion !== session.user.sessionVersion) {
    throw new AuthzError('Session expired', 401);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    throw new AuthzError('Forbidden', 403);
  }
  return user;
}

export async function requireMainAccountAccess(mainAccountId: string) {
  const user = await requireUser();
  if (user.role === 'ADMIN') return user;

  const access = await prisma.clientMainAccountAccess.findUnique({
    where: {
      userId_mainAccountId: {
        userId: user.id,
        mainAccountId,
      },
    },
    select: { id: true },
  });

  if (!access) {
    throw new AuthzError('Forbidden', 403);
  }

  return user;
}

export function authzErrorResponse(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}
