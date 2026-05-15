import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    await requireAdmin();
    const { withGoogleAuth } = await import('@/lib/googleAuth');

    return await withGoogleAuth(mainAccountId, async (oauth2Client) => {
      const analyticsAdminClient = new AnalyticsAdminServiceClient({
        authClient: oauth2Client
      });
      
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
    });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Failed to fetch Google Analytics properties:', error);
    
    const authErrors = ['NOT_CONFIGURED', 'REFRESH_FAILED', 'REFRESH_TOKEN_MISSING'];
    if (authErrors.includes(error.message) || error.code === 401 || (error.response && error.response.status === 401)) {
      return NextResponse.json({ 
        error: 'Google Analytics authentication failed', 
        code: 'AUTH_REQUIRED',
        details: error.message 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      error: 'Failed to fetch properties', 
      details: error.message,
    }, { status: 500 });
  }
}
