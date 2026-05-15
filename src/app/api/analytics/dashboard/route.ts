import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  const period = url.searchParams.get('period') || '7d';
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  
  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    await requireMainAccountAccess(mainAccountId);
    const { withGoogleAuth } = await import('@/lib/googleAuth');

    return await withGoogleAuth(mainAccountId, async (oauth2Client) => {
      const gaConfigs = await prisma.googleAnalyticsConfig.findMany({
        where: { mainAccountId }
      });

      if (gaConfigs.length === 0) {
        return NextResponse.json({ 
          properties: []
        });
      }

      const analyticsDataClient = new BetaAnalyticsDataClient({
        authClient: oauth2Client
      });

      let dateRange = { startDate: '7daysAgo', endDate: 'today' };

      if (period === 'custom' && startDate && endDate) {
        dateRange = { startDate, endDate };
      } else if (period === '30d') {
        dateRange = { startDate: '30daysAgo', endDate: 'today' };
      } else if (period === '90d') {
        dateRange = { startDate: '90daysAgo', endDate: 'today' };
      }

      const propertiesResults = [];
      
      for (const config of gaConfigs) {
        const propertyId = config.propertyId.replace('properties/', '');
        
        const [response] = await analyticsDataClient.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' }
          ],
        });

        let propertyStats = {
          activeUsers: 0,
          sessions: 0,
          screenPageViews: 0,
          bounceRate: 0,
          averageSessionDuration: 0,
          trackedEventCount: 0,
          trackedEventName: config.trackedEventName,
        };

        if (response && response.rows && response.rows.length > 0) {
          const row = response.rows[0];
          const metricValues = row.metricValues || [];
          
          propertyStats.activeUsers = parseInt(metricValues[0]?.value || '0', 10);
          propertyStats.sessions = parseInt(metricValues[1]?.value || '0', 10);
          propertyStats.screenPageViews = parseInt(metricValues[2]?.value || '0', 10);
          propertyStats.bounceRate = parseFloat(metricValues[3]?.value || '0');
          propertyStats.averageSessionDuration = parseFloat(metricValues[4]?.value || '0');
        }

        // Fetch specific event count if configured
        if (config.trackedEventName) {
          try {
            const [eventResponse] = await analyticsDataClient.runReport({
              property: `properties/${propertyId}`,
              dateRanges: [dateRange],
              dimensions: [{ name: 'eventName' }],
              metrics: [{ name: 'eventCount' }],
              dimensionFilter: {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: {
                    value: config.trackedEventName,
                    matchType: 'EXACT'
                  }
                }
              }
            });

            if (eventResponse && eventResponse.rows && eventResponse.rows.length > 0) {
              propertyStats.trackedEventCount = parseInt(eventResponse.rows[0].metricValues?.[0]?.value || '0', 10);
            }
          } catch (e) {
            console.error(`Failed to fetch event count for ${config.trackedEventName}:`, e);
          }
        }

        propertiesResults.push({
          propertyId: config.propertyId,
          propertyName: config.propertyName || 'Unknown Property',
          stats: propertyStats
        });
      }

      return NextResponse.json({ 
        properties: propertiesResults
      });
    });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Failed to fetch Google Analytics dashboard data:', error);
    
    const authErrors = ['NOT_CONFIGURED', 'REFRESH_FAILED', 'REFRESH_TOKEN_MISSING'];
    if (authErrors.includes(error.message) || error.code === 401 || (error.response && error.response.status === 401)) {
      return NextResponse.json({ 
        error: 'Google Analytics authentication failed', 
        code: 'AUTH_REQUIRED',
        details: error.message 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      error: 'Failed to fetch analytics data', 
      details: error.message,
    }, { status: 500 });
  }
}
