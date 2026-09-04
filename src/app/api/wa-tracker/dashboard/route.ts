import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';

const WA_TRACKER_SUMMARY_ENDPOINT = 'https://watracker.coyo.com.br/api/leads/summary';
const WA_TRACKER_LEADS_ENDPOINT = 'https://watracker.coyo.com.br/api/leads';
const DAILY_LEADS_PAGE_SIZE = 200;
const MAX_DAILY_LEADS_PAGES = 100;

type WaTrackerGroup = {
  source?: string | null;
  campaignId?: string | null;
  campaign_id?: string | null;
  campaign?: string | null;
  leads?: number | null;
  proposals?: number | null;
  sales?: number | null;
};

type NormalizedWaTrackerGroup = {
  id: string;
  source: string;
  campaignId: string | null;
  campaign: string;
  name: string;
  leads: number;
  proposals: number;
  sales: number;
  proposalRate: number;
  salesRate: number;
};

type WaTrackerDailyLead = {
  id?: string | null;
  conversion_time?: string | null;
  utm_campaign?: string | null;
  google_ads?: {
    campaign_id?: string | null;
    campaign_name?: string | null;
  } | null;
};

export type WaTrackerDailyLeadDatum = {
  date: string;
  leads: number;
};

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isIsoDate(value?: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function getWaTrackerDateRange(period: string, startDate?: string | null, endDate?: string | null, now = new Date()) {
  if (period === 'custom') {
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      throw new Error('Custom ranges require startDate and endDate in YYYY-MM-DD format');
    }

    if (startDate! > endDate!) {
      throw new Error('startDate cannot be after endDate');
    }

    return { from: startDate!, to: endDate! };
  }

  const to = new Date(now);
  const from = new Date(now);
  if (period === '30d') from.setDate(from.getDate() - 30);
  else if (period === '90d') from.setDate(from.getDate() - 90);
  else from.setDate(from.getDate() - 7);

  return { from: formatDate(from), to: formatDate(to) };
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeGroup(group: WaTrackerGroup, index: number): NormalizedWaTrackerGroup {
  const campaignName = !group.campaign || group.campaign === '(sem campanha)' ? 'Orgânico' : group.campaign;
  const source = group.source || 'Unknown';
  const leads = toNumber(group.leads);
  const proposals = toNumber(group.proposals);
  const sales = toNumber(group.sales);
  const campaignId = group.campaignId || group.campaign_id || null;

  return {
    id: campaignId || `${source}:${campaignName}:${index}`,
    source,
    campaignId,
    campaign: campaignName,
    name: campaignName,
    leads,
    proposals,
    sales,
    proposalRate: leads > 0 ? proposals / leads : 0,
    salesRate: leads > 0 ? sales / leads : 0,
  };
}

function countInclusiveDays(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const diffMs = toDate.getTime() - fromDate.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 1;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

function isOrganicSource(source: string) {
  const normalized = source.trim().toLowerCase();
  return normalized === 'organic' || normalized === 'organico' || normalized === 'orgânico';
}

function normalizeCampaign(value?: string | null) {
  return !value || value === '(sem campanha)' ? 'Orgânico' : value;
}

function matchesCampaign(lead: WaTrackerDailyLead, campaignFilter: string) {
  if (campaignFilter === 'all') return true;

  const googleAds = lead.google_ads || {};
  return normalizeCampaign(googleAds.campaign_name || lead.utm_campaign) === campaignFilter
    || googleAds.campaign_id === campaignFilter
    || lead.utm_campaign === campaignFilter;
}

function getDateKey(value?: string | null) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null;
}

export function buildDailyLeadSeries(
  from: string,
  to: string,
  leads: WaTrackerDailyLead[],
  campaignFilter = 'all',
): WaTrackerDailyLeadDatum[] {
  const totals = new Map<string, number>();

  leads.forEach((lead) => {
    if (!matchesCampaign(lead, campaignFilter)) return;
    const date = getDateKey(lead.conversion_time);
    if (!date || date < from || date > to) return;
    totals.set(date, (totals.get(date) || 0) + 1);
  });

  const series: WaTrackerDailyLeadDatum[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const lastDate = new Date(`${to}T00:00:00.000Z`);

  while (cursor <= lastDate) {
    const date = formatDate(cursor);
    series.push({ date, leads: totals.get(date) || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

async function fetchDailyLeads(
  accountId: string,
  token: string,
  from: string,
  to: string,
  campaignFilter: string,
) {
  const leads: WaTrackerDailyLead[] = [];
  const seenCursors = new Set<string>();
  let nextCursor: string | null = null;

  for (let page = 0; page < MAX_DAILY_LEADS_PAGES; page += 1) {
    const apiUrl = new URL(WA_TRACKER_LEADS_ENDPOINT);
    apiUrl.searchParams.set('account_id', accountId);
    apiUrl.searchParams.set('from', from);
    apiUrl.searchParams.set('to', to);
    apiUrl.searchParams.set('page_size', String(DAILY_LEADS_PAGE_SIZE));
    if (nextCursor) apiUrl.searchParams.set('cursor', nextCursor);

    const response = await fetch(apiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        error: {
          status: response.status,
          details: await response.text().catch(() => ''),
        },
      };
    }

    const payload = await response.json();
    if (Array.isArray(payload?.data)) leads.push(...payload.data);

    const hasMore = Boolean(payload?.pagination?.has_more);
    const cursor = typeof payload?.pagination?.next_cursor === 'string'
      ? payload.pagination.next_cursor
      : null;

    if (!hasMore || !cursor) {
      return { dailyLeads: buildDailyLeadSeries(from, to, leads, campaignFilter) };
    }

    if (seenCursors.has(cursor)) {
      return { error: { status: 502, details: 'WA Tracker returned a repeated pagination cursor' } };
    }

    seenCursors.add(cursor);
    nextCursor = cursor;
  }

  return { error: { status: 502, details: 'WA Tracker lead history exceeded the pagination safety limit' } };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  const period = url.searchParams.get('period') || '7d';
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const campaignFilter = url.searchParams.get('campaign') || 'all';

  if (!mainAccountId) {
    return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  }

  try {
    await requireMainAccountAccess(mainAccountId);

    const account = await prisma.mainAccount.findUnique({
      where: { id: mainAccountId },
      select: { waTrackerAccountId: true },
    });

    if (!account?.waTrackerAccountId) {
      return NextResponse.json({ code: 'NOT_CONFIGURED', message: 'WA Tracker Account ID is not configured' }, { status: 400 });
    }

    const token = process.env.WA_TRACKER_API_TOKEN;
    if (!token) {
      return NextResponse.json({ code: 'NOT_CONFIGURED', message: 'WA Tracker API token is not configured' }, { status: 500 });
    }

    const { from, to } = getWaTrackerDateRange(period, startDate, endDate);
    const apiUrl = new URL(WA_TRACKER_SUMMARY_ENDPOINT);
    apiUrl.searchParams.set('account_id', account.waTrackerAccountId);
    apiUrl.searchParams.set('from', from);
    apiUrl.searchParams.set('to', to);

    const response = await fetch(apiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      return NextResponse.json({
        error: 'Failed to fetch WA Tracker data',
        status: response.status,
        details,
      }, { status: response.status >= 400 && response.status < 600 ? response.status : 502 });
    }

    const payload = await response.json();
    const groups: NormalizedWaTrackerGroup[] = Array.isArray(payload?.groups) ? payload.groups.map(normalizeGroup) : [];
    const filteredGroups = campaignFilter === 'all'
      ? groups
      : groups.filter((group: NormalizedWaTrackerGroup) => group.campaign === campaignFilter || group.campaignId === campaignFilter);

    const summary = filteredGroups.reduce((acc, group: NormalizedWaTrackerGroup) => {
      const organic = isOrganicSource(group.source);

      return {
        totalLeads: acc.totalLeads + group.leads,
        totalOrganicLeads: acc.totalOrganicLeads + (organic ? group.leads : 0),
        totalAdsLeads: acc.totalAdsLeads + (organic ? 0 : group.leads),
        totalProposals: acc.totalProposals + group.proposals,
        totalSales: acc.totalSales + group.sales,
      };
    }, { totalLeads: 0, totalOrganicLeads: 0, totalAdsLeads: 0, totalProposals: 0, totalSales: 0 });
    const days = countInclusiveDays(from, to);
    const dailyResult = await fetchDailyLeads(
      account.waTrackerAccountId,
      token,
      from,
      to,
      campaignFilter,
    );

    if (dailyResult.error) {
      return NextResponse.json({
        error: 'Failed to fetch WA Tracker daily leads',
        status: dailyResult.error.status,
        details: dailyResult.error.details,
      }, { status: dailyResult.error.status >= 400 && dailyResult.error.status < 600 ? dailyResult.error.status : 502 });
    }

    return NextResponse.json({
      dateRange: { from, to },
      dailyLeads: dailyResult.dailyLeads,
      summary: {
        ...summary,
        avgLeadsPerDay: summary.totalLeads / days,
        proposalRate: summary.totalLeads > 0 ? summary.totalProposals / summary.totalLeads : 0,
        salesRate: summary.totalLeads > 0 ? summary.totalSales / summary.totalLeads : 0,
      },
      campaigns: filteredGroups,
      campaignOptions: groups.map((group: NormalizedWaTrackerGroup) => ({
        id: group.campaignId,
        name: group.campaign,
        source: group.source,
      })),
    });
  } catch (error: unknown) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;

    const message = error instanceof Error ? error.message : 'Failed to fetch WA Tracker dashboard';
    const status = message.includes('date') || message.includes('startDate') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
