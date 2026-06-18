import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';

const WA_TRACKER_SUMMARY_ENDPOINT = 'https://watracker.coyo.com.br/api/leads/summary';

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

    const summary = filteredGroups.reduce((acc, group: NormalizedWaTrackerGroup) => ({
      totalLeads: acc.totalLeads + group.leads,
      totalProposals: acc.totalProposals + group.proposals,
      totalSales: acc.totalSales + group.sales,
    }), { totalLeads: 0, totalProposals: 0, totalSales: 0 });
    const days = countInclusiveDays(from, to);

    return NextResponse.json({
      dateRange: { from, to },
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
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;

    const message = error?.message || 'Failed to fetch WA Tracker dashboard';
    const status = message.includes('date') || message.includes('startDate') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
