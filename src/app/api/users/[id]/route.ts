import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  clientMainAccountAccesses: {
    select: {
      mainAccountId: true,
      mainAccount: { select: { id: true, name: true } },
    },
  },
};

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function incrementSessionVersion(data: any) {
  data.sessionVersion = { increment: 1 };
}

async function assertCanRemoveAdmin(userId: string, nextRole?: string, nextStatus?: string) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  if (!existing || existing.role !== 'ADMIN' || existing.status !== 'ACTIVE') return;

  const wouldNoLongerBeActiveAdmin = nextRole === 'CLIENT' || nextStatus === 'DISABLED';
  if (!wouldNoLongerBeActiveAdmin) return;

  const activeAdmins = await prisma.user.count({
    where: {
      role: 'ADMIN',
      status: 'ACTIVE',
      id: { not: userId },
    },
  });

  if (activeAdmins === 0) {
    throw new Error('LAST_ADMIN');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data: any = {};

    if (body.name !== undefined) {
      data.name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
    }
    if (body.email !== undefined) {
      const normalizedEmail = normalizeEmail(body.email);
      if (!normalizedEmail) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      }
      data.email = normalizedEmail;
      incrementSessionVersion(data);
    }
    if (body.role !== undefined) {
      if (body.role !== 'ADMIN' && body.role !== 'CLIENT') {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      data.role = body.role;
      incrementSessionVersion(data);
    }
    if (body.status !== undefined) {
      if (body.status !== 'ACTIVE' && body.status !== 'DISABLED') {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      data.status = body.status;
      incrementSessionVersion(data);
    }
    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      data.passwordHash = await bcrypt.hash(body.password, 12);
      incrementSessionVersion(data);
    }

    await assertCanRemoveAdmin(id, data.role, data.status);

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data,
        select: userSelect,
      });

      if (Array.isArray(body.mainAccountIds)) {
        await tx.clientMainAccountAccess.deleteMany({ where: { userId: id } });
        if (updated.role === 'CLIENT' && body.mainAccountIds.length > 0) {
          await tx.clientMainAccountAccess.createMany({
            data: body.mainAccountIds.map((mainAccountId: string) => ({ userId: id, mainAccountId })),
            skipDuplicates: true,
          });
        }
      } else if (updated.role === 'ADMIN') {
        await tx.clientMainAccountAccess.deleteMany({ where: { userId: id } });
      }

      return tx.user.findUniqueOrThrow({ where: { id }, select: userSelect });
    });

    return NextResponse.json({ user });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    if (error?.message === 'LAST_ADMIN') {
      return NextResponse.json({ error: 'At least one active admin is required' }, { status: 400 });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await assertCanRemoveAdmin(id, 'CLIENT', 'DISABLED');
    await prisma.user.delete({ where: { id }, select: { id: true } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    if (error?.message === 'LAST_ADMIN') {
      return NextResponse.json({ error: 'At least one active admin is required' }, { status: 400 });
    }
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
