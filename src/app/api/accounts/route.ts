import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireAdmin, requireUser } from '@/lib/authz';

export async function GET() {
  try {
    const user = await requireUser();
    const accounts = await prisma.mainAccount.findMany({
      where: user.role === 'ADMIN' ? undefined : {
        clientAccesses: {
          some: { userId: user.id },
        },
      },
      include: {
        googleCredential: true,
        googleAdsConfigs: true,
        googleAnalyticsConfigs: true,
        googleSearchConsoleConfigs: true,
        metaCredential: true,
        metaAdsConfigs: true,
        facebookPageConfigs: true,
        instagramPageConfigs: true,
      }
    });
    return NextResponse.json({ accounts: accounts.map(({ coyoTaskManagerKey, ...account }) => ({ ...account, hasCoyoTaskManagerKey: Boolean(coyoTaskManagerKey) })) });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Failed to fetch accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { name } = await request.json();
    const account = await prisma.mainAccount.create({
      data: { name: name || 'My Business' }
    });
    const { coyoTaskManagerKey, ...safeAccount } = account;
    return NextResponse.json({ account: { ...safeAccount, hasCoyoTaskManagerKey: Boolean(coyoTaskManagerKey) } });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Failed to create account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
