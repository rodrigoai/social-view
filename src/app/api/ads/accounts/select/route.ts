import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { mainAccountId, customerId } = await request.json();

    if (!mainAccountId || !customerId) {
      return NextResponse.json({ error: 'Missing mainAccountId or customerId' }, { status: 400 });
    }

    await prisma.googleAdsConfig.update({
      where: { mainAccountId },
      data: { customerId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to select Google Ads account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
