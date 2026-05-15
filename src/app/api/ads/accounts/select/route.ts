import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { mainAccountId, customerId } = await request.json();

    if (!mainAccountId || !customerId) {
      return NextResponse.json({ error: 'Missing mainAccountId or customerId' }, { status: 400 });
    }

    await prisma.googleAdsConfig.upsert({
      where: { 
        mainAccountId_customerId: {
          mainAccountId,
          customerId
        }
      },
      update: {},
      create: {
        mainAccountId,
        customerId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Failed to select Google Ads account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
