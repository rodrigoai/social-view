import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const mainAccountId = searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    // Delete the meta credential and all associated configs
    await prisma.$transaction([
      prisma.metaAdsConfig.deleteMany({ where: { mainAccountId } }),
      prisma.facebookPageConfig.deleteMany({ where: { mainAccountId } }),
      prisma.instagramPageConfig.deleteMany({ where: { mainAccountId } }),
      prisma.metaCredential.delete({ where: { mainAccountId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error disconnecting Meta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
