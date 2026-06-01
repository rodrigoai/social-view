import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCustomer } from '@/lib/googleAds';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  const period = url.searchParams.get('period') || '7d';
  const campaignFilter = url.searchParams.get('campaign') || 'all';
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  
  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  // Map period to Google Ads date constants
  const dateMap: Record<string, string> = {
    '7d': 'LAST_7_DAYS',
    '30d': 'LAST_30_DAYS'
  };

  try {
    await requireMainAccountAccess(mainAccountId);
    const { withGoogleAuth } = await import('@/lib/googleAuth');

    return await withGoogleAuth(mainAccountId, async (oauth2Client) => {
      const adsConfigs = await prisma.googleAdsConfig.findMany({
        where: { mainAccountId }
      });

      if (adsConfigs.length === 0 || !adsConfigs[0].customerId) {
        return NextResponse.json({ 
          campaigns: [],
          summary: {
            totalCost: 0,
            totalConversions: 0,
            totalClicks: 0
          }
        });
      }

      const tokens = await oauth2Client.getAccessToken();

      const constraints: any = {};
      if (campaignFilter && campaignFilter !== 'all') {
        const numericId = Number(campaignFilter);
        if (!isNaN(numericId) && campaignFilter.length > 5) {
          constraints['campaign.id'] = numericId;
        } else {
          constraints['campaign.name'] = campaignFilter;
        }
      }

      // Prepare report options
      const reportOptions: any = {
        entity: 'campaign',
        attributes: [
          'campaign.id', 
          'campaign.name', 
          'campaign.primary_status',
          'campaign.serving_status'
        ],
        metrics: ['metrics.cost_micros', 'metrics.conversions', 'metrics.clicks'],
        constraints,
      };

      // Add status filters to constraints
      constraints['campaign.primary_status'] = [
        'ELIGIBLE',
        'LEARNING',
        'LIMITED',
        'MISCONFIGURED'
      ];

      if (period === 'custom' && startDate && endDate) {
        reportOptions.from_date = startDate;
        reportOptions.to_date = endDate;
      } else if (period === '90d') {
        const today = new Date();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(today.getDate() - 90);
        
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        reportOptions.from_date = formatDate(ninetyDaysAgo);
        reportOptions.to_date = formatDate(today);
      } else {
        reportOptions.date_constant = dateMap[period] || 'LAST_7_DAYS';
      }

      const allCampaigns = await Promise.all(
        adsConfigs
          .filter(config => Boolean(config.customerId))
          .map(async (config) => {
            const customer = getCustomer(
              tokens.token!,
              config.customerId,
              oauth2Client.credentials.refresh_token || undefined
            );
            const campaigns = await customer.report(reportOptions);

            return campaigns.map((campaign: any) => ({
              customerId: config.customerId,
              campaign,
            }));
          })
      );

      const formattedCampaigns = allCampaigns.flat().map(({ customerId, campaign }: any) => ({
        id: `${customerId}:${campaign.campaign.id}`,
        customerId,
        name: campaign.campaign.name,
        status: campaign.campaign.primary_status,
        cost: (campaign.metrics.cost_micros || 0) / 1000000,
        conversions: campaign.metrics.conversions || 0,
        clicks: campaign.metrics.clicks || 0,
      }));

      const totalCost = formattedCampaigns.reduce((acc, curr) => acc + curr.cost, 0);
      const totalConversions = formattedCampaigns.reduce((acc, curr) => acc + curr.conversions, 0);
      const totalClicks = formattedCampaigns.reduce((acc, curr) => acc + curr.clicks, 0);

      return NextResponse.json({ 
        campaigns: formattedCampaigns,
        summary: {
          totalCost,
          totalConversions,
          totalClicks
        }
      });
    });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Error fetching campaigns:', error);
    
    const authErrors = ['NOT_CONFIGURED', 'REFRESH_FAILED', 'REFRESH_TOKEN_MISSING'];
    if (authErrors.includes(error.message) || error.code === 401 || (error.response && error.response.status === 401)) {
      return NextResponse.json({ 
        error: 'Google Ads authentication failed', 
        code: 'AUTH_REQUIRED',
        details: error.message 
      }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch campaigns', details: error.message }, { status: 500 });
  }
}
