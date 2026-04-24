import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { mainAccountId, properties } = await request.json();

    if (!mainAccountId || !properties || !Array.isArray(properties)) {
      return NextResponse.json({ error: 'Missing mainAccountId or valid properties array' }, { status: 400 });
    }

    // First, delete any existing properties for this mainAccount
    await prisma.googleAnalyticsConfig.deleteMany({
      where: { mainAccountId }
    });

    // Then, insert the newly selected properties
    if (properties.length > 0) {
      await prisma.googleAnalyticsConfig.createMany({
        data: properties.map((prop: { id: string, name: string }) => ({
          mainAccountId,
          propertyId: prop.id,
          propertyName: prop.name,
        }))
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to select Google Analytics properties:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
