import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

// Helper to format date for Search Console (YYYY-MM-DD)
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  const period = url.searchParams.get('period') || '7d';
  const startDateParam = url.searchParams.get('startDate');
  const endDateParam = url.searchParams.get('endDate');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    const { withGoogleAuth } = await import('@/lib/googleAuth');

    return await withGoogleAuth(mainAccountId, async (authClient) => {
      const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

      const scConfigs = await prisma.googleSearchConsoleConfig.findMany({
        where: { mainAccountId }
      });

      if (scConfigs.length === 0) {
        return NextResponse.json({ sites: [] });
      }

      let startDate: string;
      let endDate: string;

      if (period === 'custom' && startDateParam && endDateParam) {
        startDate = startDateParam;
        endDate = endDateParam;
      } else {
        const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
        
        // Search Console data is typically 2-3 days delayed
        const end = new Date();
        end.setDate(end.getDate() - 3);
        endDate = formatDate(end);

        const start = new Date(end);
        start.setDate(start.getDate() - days);
        startDate = formatDate(start);
      }

      const sitesResults = [];

      for (const config of scConfigs) {
        try {
          const response = await searchconsole.searchanalytics.query({
            siteUrl: config.siteUrl,
            requestBody: {
              startDate,
              endDate,
              // No dimensions means we get totals for the whole site
              rowLimit: 1
            }
          });

          // Search Console returns one row with totals if no dimensions are specified
          const stats = response.data.rows?.[0] || {
            clicks: 0,
            impressions: 0,
            ctr: 0,
            position: 0
          };

          sitesResults.push({
            siteUrl: config.siteUrl,
            stats: {
              clicks: stats.clicks || 0,
              impressions: stats.impressions || 0,
              ctr: stats.ctr || 0,
              position: stats.position || 0
            }
          });
        } catch (e: any) {
          console.error(`Failed to fetch Search Console stats for ${config.siteUrl}:`, e.message);
          sitesResults.push({
            siteUrl: config.siteUrl,
            error: e.message,
            stats: { clicks: 0, impressions: 0, ctr: 0, position: 0 }
          });
        }
      }

      return NextResponse.json({ sites: sitesResults });
    });
  } catch (error: any) {
    console.error('Search Console Dashboard Error:', error);
    
    const authErrors = ['NOT_CONFIGURED', 'REFRESH_FAILED', 'REFRESH_TOKEN_MISSING'];
    if (authErrors.includes(error.message) || error.code === 401 || (error.response && error.response.status === 401)) {
      return NextResponse.json({ 
        error: 'Google Search Console authentication failed', 
        code: 'AUTH_REQUIRED',
        details: error.message 
      }, { status: 401 });
    }

    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
