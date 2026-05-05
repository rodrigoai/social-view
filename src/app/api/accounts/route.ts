import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.mainAccount.findMany({
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
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    const account = await prisma.mainAccount.create({
      data: { name: name || 'My Business' }
    });
    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
