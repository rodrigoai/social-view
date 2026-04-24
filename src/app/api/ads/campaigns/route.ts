import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCustomer } from '@/lib/googleAds';

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
    const { getAuthorizedClient } = await import('@/lib/googleAuth');
    let oauth2Client;
    
    try {
      oauth2Client = await getAuthorizedClient(mainAccountId);
    } catch (authError: any) {
      if (['NOT_CONFIGURED', 'REFRESH_FAILED', 'REFRESH_TOKEN_MISSING'].includes(authError.message)) {
        return NextResponse.json({ 
          error: 'Google Ads authentication failed', 
          code: 'AUTH_REQUIRED',
          details: authError.message 
        }, { status: 401 });
      }
      throw authError;
    }

    const adsConfigs = await prisma.googleAdsConfig.findMany({
      where: { mainAccountId }
    });

    if (adsConfigs.length === 0 || !adsConfigs[0].customerId) {
      return NextResponse.json({ 
        campaigns: [],
        summary: {
          totalCost: 0,
          totalConversions: 0
        }
      });
    }


    const tokens = await oauth2Client.getAccessToken();
    const customerId = adsConfigs[0].customerId;
    const customer = getCustomer(tokens.token!, customerId, oauth2Client.credentials.refresh_token || undefined);

    
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
      metrics: ['metrics.cost_micros', 'metrics.conversions'],
      constraints,
    };

    // Add status filters to constraints
    // "Qualified" usually includes ELIGIBLE, LEARNING, LIMITED, MISCONFIGURED
    constraints['campaign.primary_status'] = [
      'ELIGIBLE',
      'LEARNING',
      'LIMITED',
      'MISCONFIGURED'
    ];

    if (period === 'custom' && startDate && endDate) {
      // API expects from_date and to_date (YYYY-MM-DD)
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

    // Fetch campaigns with metrics
    const campaigns = await customer.report(reportOptions);

    const formattedCampaigns = campaigns.map((c: any) => ({
      id: c.campaign.id,
      name: c.campaign.name,
      status: c.campaign.primary_status,
      cost: (c.metrics.cost_micros || 0) / 1000000, 
      conversions: c.metrics.conversions || 0,
    }));

    const totalCost = formattedCampaigns.reduce((acc, curr) => acc + curr.cost, 0);
    const totalConversions = formattedCampaigns.reduce((acc, curr) => acc + curr.conversions, 0);

    return NextResponse.json({ 
      campaigns: formattedCampaigns,
      summary: {
        totalCost,
        totalConversions
      }
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
