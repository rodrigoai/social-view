import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { type, mainAccountId } = await request.json();

    if (!type || !mainAccountId) {
      return NextResponse.json({ error: 'Missing type or mainAccountId' }, { status: 400 });
    }

    switch (type) {
      case 'google-ads':
        await prisma.googleAdsConfig.deleteMany({ where: { mainAccountId } });
        break;
      case 'google-analytics':
        await prisma.googleAnalyticsConfig.deleteMany({ where: { mainAccountId } });
        break;
      case 'google-search-console':
        await prisma.googleSearchConsoleConfig.deleteMany({ where: { mainAccountId } });
        break;
      case 'meta-ads':
        await prisma.metaAdsConfig.deleteMany({ where: { mainAccountId } });
        break;
      case 'facebook-pages':
        await prisma.facebookPageConfig.deleteMany({ where: { mainAccountId } });
        break;
      case 'instagram':
        await prisma.instagramPageConfig.deleteMany({ where: { mainAccountId } });
        break;
      default:
        return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Error clearing integration:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
