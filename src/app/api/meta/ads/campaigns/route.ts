import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bizSdk from 'facebook-nodejs-business-sdk';
import { getMetaAccessToken, isMetaAuthError } from '@/lib/metaAuth';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';

const AdAccount = bizSdk.AdAccount;
const LEAD_ACTION = 'lead';
const MESSAGING_CONVERSATION_STARTED_ACTION = 'onsite_conversion.messaging_conversation_started_7d';
const RESULT_ACTION_TYPES = [LEAD_ACTION, MESSAGING_CONVERSATION_STARTED_ACTION];

function getActionValue(actions: Array<{ action_type?: string; value?: string | number }> | undefined, actionType: string) {
  const action = actions?.find((item) => item.action_type === actionType);
  return Number(action?.value || 0);
}

function getCostPerResult(
  costPerActionType: Array<{ action_type?: string; value?: string | number }> | undefined,
  actions: Array<{ action_type?: string; value?: string | number }> | undefined
) {
  for (const actionType of RESULT_ACTION_TYPES) {
    const cost = costPerActionType?.find((item) => item.action_type === actionType);
    if (cost) {
      return {
        value: Number(cost.value || 0),
        resultCount: getActionValue(actions, actionType),
        actionType
      };
    }
  }

  return { value: 0, resultCount: 0, actionType: null };
}

function getDateRange(period: string, startDate?: string, endDate?: string) {
  if (period === 'custom' && startDate && endDate) {
    return { since: startDate, until: endDate };
  }

  const end = new Date();
  const start = new Date();
  if (period === '30d') start.setDate(start.getDate() - 30);
  else if (period === '90d') start.setDate(start.getDate() - 90);
  else start.setDate(start.getDate() - 7); // Default to 7d

  return {
    since: start.toISOString().split('T')[0],
    until: end.toISOString().split('T')[0]
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  const period = url.searchParams.get('period') || '7d';
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;
  const campaignFilter = url.searchParams.get('campaign') || 'all';

  if (!mainAccountId) {
    return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  }

  try {
    await requireMainAccountAccess(mainAccountId);
    const accessToken = await getMetaAccessToken(mainAccountId);

    const configs = await prisma.metaAdsConfig.findMany({ where: { mainAccountId } });
    if (!configs || configs.length === 0) {
      return NextResponse.json({ summary: { totalCost: 0, totalConversions: 0, totalMessagingConversationsStarted: 0, totalCostPerResult: 0, totalReach: 0, totalImpressions: 0 }, campaigns: [] });
    }

    const timeRange = getDateRange(period, startDate, endDate);
    
    // Initialize SDK
    bizSdk.FacebookAdsApi.init(accessToken);

    let totalCost = 0;
    let totalConversions = 0; // Leads
    let totalMessagingConversationsStarted = 0;
    let totalResults = 0;
    let totalReach = 0;
    let totalImpressions = 0;
    const allCampaigns = [];

    // Fetch insights for each connected ad account
    for (const config of configs) {
      const accountId = config.adAccountId.startsWith('act_') ? config.adAccountId : `act_${config.adAccountId}`;
      const account = new AdAccount(accountId);

      const fields = ['campaign_id', 'campaign_name', 'spend', 'reach', 'impressions', 'actions', 'cost_per_action_type'];
      const params = {
        time_range: timeRange,
        level: 'campaign'
      };

      try {
        const insights = await account.getInsights(fields, params);
        
        for (const insight of insights) {
          const name = insight.campaign_name;
          if (campaignFilter !== 'all' && name !== campaignFilter) continue;

          const spend = parseFloat(insight.spend || '0');
          const reach = parseInt(insight.reach || '0');
          const impressions = parseInt(insight.impressions || '0');
          
          const leads = getActionValue(insight.actions, LEAD_ACTION);
          const messagingConversationsStarted = getActionValue(
            insight.actions,
            MESSAGING_CONVERSATION_STARTED_ACTION
          );
          const costPerResult = getCostPerResult(insight.cost_per_action_type, insight.actions);

          totalCost += spend;
          totalConversions += leads;
          totalMessagingConversationsStarted += messagingConversationsStarted;
          totalResults += costPerResult.resultCount;
          totalReach += reach;
          totalImpressions += impressions;

          allCampaigns.push({
            id: insight.campaign_id,
            name: name,
            status: 'ACTIVE', // Meta SDK doesn't return campaign status in insights endpoint directly, we would need to fetch campaigns specifically. For simplicity, just listing them.
            cost: spend,
            conversions: leads,
            messagingConversationsStarted,
            costPerResult: costPerResult.value,
            resultActionType: costPerResult.actionType,
            reach: reach,
            impressions: impressions,
          });
        }
      } catch (err: any) {
        console.error(`Error fetching insights for account ${accountId}:`, err.message);
        // Continue to the next account even if one fails
      }
    }

    return NextResponse.json({
      summary: {
        totalCost,
        totalConversions,
        totalMessagingConversationsStarted,
        totalCostPerResult: totalResults > 0 ? totalCost / totalResults : 0,
        totalReach,
        totalImpressions,
      },
      campaigns: allCampaigns
    });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Meta Ads Dashboard Error:', error);
    if (isMetaAuthError(error)) {
      return NextResponse.json({ code: 'AUTH_REQUIRED', message: 'Meta authentication failed' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
