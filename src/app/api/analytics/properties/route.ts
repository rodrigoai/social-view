import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    const config = await prisma.googleCredential.findUnique({
      where: { mainAccountId }
    });

    if (!config || !config.accessToken) {
      return NextResponse.json({ error: 'Google Account not configured or authenticated' }, { status: 401 });
    }

    const { getGoogleOAuthClient } = await import('@/lib/googleAuth');
    const oauth2Client = getGoogleOAuthClient();
    
    oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
    });

    const analyticsAdminClient = new AnalyticsAdminServiceClient({
      authClient: oauth2Client
    });
    
    // The correct method is listAccountSummaries
    const [accountSummaries] = await analyticsAdminClient.listAccountSummaries();
    
    const properties: any[] = [];
    
    if (accountSummaries) {
      for (const account of accountSummaries) {
        if (account.propertySummaries) {
          for (const prop of account.propertySummaries) {
            properties.push({
              id: prop.property,
              name: `${account.displayName} > ${prop.displayName}`,
              parentAccount: account.displayName
            });
          }
        }
      }
    }

    return NextResponse.json({ properties });

  } catch (error: any) {
    console.error('Failed to fetch Google Analytics properties:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch properties', 
      details: error.message,
    }, { status: 500 });
  }
}
