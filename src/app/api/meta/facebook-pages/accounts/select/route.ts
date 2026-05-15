import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { mainAccountId, accountId, accountName, accessToken } = await request.json();

    if (!mainAccountId || !accountId) {
      return NextResponse.json({ error: 'Missing mainAccountId or accountId' }, { status: 400 });
    }

    await prisma.facebookPageConfig.upsert({
      where: {
        mainAccountId_pageId: {
          mainAccountId,
          pageId: accountId
        }
      },
      update: {
        pageName: accountName,
        accessToken
      },
      create: {
        mainAccountId,
        pageId: accountId,
        pageName: accountName,
        accessToken
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Facebook Page Selection Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
