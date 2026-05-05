import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const mainAccountId = searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    // Delete the google credential and all associated configs
    await prisma.$transaction([
      prisma.googleAdsConfig.deleteMany({ where: { mainAccountId } }),
      prisma.googleAnalyticsConfig.deleteMany({ where: { mainAccountId } }),
      prisma.googleSearchConsoleConfig.deleteMany({ where: { mainAccountId } }),
      prisma.googleCredential.delete({ where: { mainAccountId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error disconnecting Google:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
