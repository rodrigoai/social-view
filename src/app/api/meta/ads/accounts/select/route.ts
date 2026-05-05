import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { mainAccountId, accountId, accountName } = await request.json();

    if (!mainAccountId || !accountId) {
      return NextResponse.json({ error: 'Missing mainAccountId or accountId' }, { status: 400 });
    }

    await prisma.metaAdsConfig.upsert({
      where: {
        mainAccountId_adAccountId: {
          mainAccountId,
          adAccountId: accountId
        }
      },
      update: {
        adAccountName: accountName
      },
      create: {
        mainAccountId,
        adAccountId: accountId,
        adAccountName: accountName
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Meta Ads Selection Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
