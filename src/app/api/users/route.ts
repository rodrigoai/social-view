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

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });
    return NextResponse.json({ users });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { email, name, password, role, mainAccountIds = [] } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Email and an 8+ character password are required' }, { status: 400 });
    }

    if (role !== 'ADMIN' && role !== 'CLIENT') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (!Array.isArray(mainAccountIds)) {
      return NextResponse.json({ error: 'mainAccountIds must be an array' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: typeof name === 'string' && name.trim() ? name.trim() : null,
        passwordHash,
        role,
        clientMainAccountAccesses: role === 'CLIENT'
          ? {
              create: mainAccountIds.map((mainAccountId: string) => ({ mainAccountId })),
            }
          : undefined,
      },
      select: userSelect,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
