import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { mainAccountId, sites } = await request.json();

    if (!mainAccountId || !sites || !Array.isArray(sites)) {
      return NextResponse.json({ error: 'Missing mainAccountId or valid sites array' }, { status: 400 });
    }

    // First, delete any existing sites for this mainAccount
    await prisma.googleSearchConsoleConfig.deleteMany({
      where: { mainAccountId }
    });

    // Then, insert the newly selected sites
    if (sites.length > 0) {
      await prisma.googleSearchConsoleConfig.createMany({
        data: sites.map((site: { siteUrl: string }) => ({
          mainAccountId,
          siteUrl: site.siteUrl
        }))
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to select Search Console sites:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
