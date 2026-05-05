import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { mainAccountId, accountId, accountName, facebookPageId } = await request.json();

    if (!mainAccountId || !accountId) {
      return NextResponse.json({ error: 'Missing mainAccountId or accountId' }, { status: 400 });
    }

    await prisma.instagramPageConfig.upsert({
      where: {
        mainAccountId_igAccountId: {
          mainAccountId,
          igAccountId: accountId
        }
      },
      update: {
        igAccountName: accountName,
        facebookPageId
      },
      create: {
        mainAccountId,
        igAccountId: accountId,
        igAccountName: accountName,
        facebookPageId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Instagram Selection Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
