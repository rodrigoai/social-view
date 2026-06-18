import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { getWaTrackerDateRange } from '@/app/api/wa-tracker/dashboard/route';

const WA_TRACKER_LEADS_ENDPOINT = 'https://watracker.coyo.com.br/api/leads';
const VALID_STATUSES = new Set(['Not Qualified', 'Proposta', 'Venda']);
const MAX_PAGES_PER_REQUEST = 5;

type WaTrackerLead = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  conversion_time?: string | null;
  conversion_name?: string | null;
  value?: number | null;
  currency?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_medium?: string | null;
  enrichment_status?: string | null;
  google_ads?: {
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    campaign_id?: string | null;
    campaign_name?: string | null;
    ad_group_id?: string | null;
    ad_group_name?: string | null;
    gclid_keyword?: string | null;
    gclid_match_type?: string | null;
    gclid_ad_id?: string | null;
    gclid_click_date?: string | null;
    gclid_ad_network_type?: string | null;
    gclid_page_number?: number | null;
    gclid_geo_interest_country?: string | null;
    gclid_geo_interest_region?: string | null;
    gclid_geo_presence_country?: string | null;
    gclid_geo_presence_region?: string | null;
  } | null;
};

type NormalizedLead = WaTrackerLead & {
  id: string;
  status: string;
  source: string;
  campaign: string;
};

function normalizeCampaign(value?: string | null) {
  if (!value || value === '(sem campanha)') return 'Orgânico';
  return value;
}

function normalizeLead(lead: WaTrackerLead): NormalizedLead {
  const googleAds = lead.google_ads || {};
  const source = googleAds.gclid || googleAds.gbraid || googleAds.wbraid
    ? 'Google'
    : normalizeCampaign(lead.utm_source) === 'Orgânico'
      ? 'Orgânico'
      : lead.utm_source || 'Orgânico';

  return {
    ...lead,
    id: lead.id || `${lead.conversion_time || 'lead'}:${lead.phone || lead.email || lead.name || 'unknown'}`,
    status: lead.status || 'Not Qualified',
    source,
    campaign: normalizeCampaign(googleAds.campaign_name || lead.utm_campaign),
    google_ads: googleAds,
  };
}

function matchesCampaign(lead: NormalizedLead, campaignFilter: string) {
  if (campaignFilter === 'all') return true;
  return lead.campaign === campaignFilter
    || lead.google_ads?.campaign_id === campaignFilter
    || lead.utm_campaign === campaignFilter;
}

function parsePageSize(value: string | null) {
  const pageSize = Number(value || 50);
  if (!Number.isInteger(pageSize) || pageSize < 1) return 50;
  return Math.min(pageSize, 200);
}

async function fetchLeadPage(apiUrl: URL, token: string) {
  const response = await fetch(apiUrl.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    return { response, details, payload: null };
  }

  return { response, details: '', payload: await response.json() };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  const period = url.searchParams.get('period') || '7d';
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const campaignFilter = url.searchParams.get('campaign') || 'all';
  const statusFilter = url.searchParams.get('status') || 'all';
  const cursor = url.searchParams.get('cursor');
  const pageSize = parsePageSize(url.searchParams.get('page_size'));

  if (!mainAccountId) {
    return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  }

  if (statusFilter !== 'all' && !VALID_STATUSES.has(statusFilter)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
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
    let nextCursor = cursor;
    let hasMore = Boolean(cursor);
    let upstreamPageSize = pageSize;
    const leads: NormalizedLead[] = [];

    for (let page = 0; page < MAX_PAGES_PER_REQUEST && leads.length < pageSize; page += 1) {
      const apiUrl = new URL(WA_TRACKER_LEADS_ENDPOINT);
      apiUrl.searchParams.set('account_id', account.waTrackerAccountId);
      apiUrl.searchParams.set('from', from);
      apiUrl.searchParams.set('to', to);
      apiUrl.searchParams.set('page_size', String(pageSize));
      if (nextCursor) apiUrl.searchParams.set('cursor', nextCursor);
      if (statusFilter !== 'all') apiUrl.searchParams.append('status', statusFilter);

      const { response, details, payload } = await fetchLeadPage(apiUrl, token);
      if (!response.ok) {
        return NextResponse.json({
          error: 'Failed to fetch WA Tracker leads',
          status: response.status,
          details,
        }, { status: response.status >= 400 && response.status < 600 ? response.status : 502 });
      }

      const pageLeads = Array.isArray(payload?.data) ? payload.data.map(normalizeLead) : [];
      leads.push(...pageLeads.filter((lead: NormalizedLead) => matchesCampaign(lead, campaignFilter)));

      nextCursor = payload?.pagination?.next_cursor || null;
      hasMore = Boolean(payload?.pagination?.has_more);
      upstreamPageSize = payload?.pagination?.page_size || pageSize;
      if (!hasMore || !nextCursor) break;
    }

    return NextResponse.json({
      data: leads.slice(0, pageSize),
      pagination: {
        next_cursor: nextCursor,
        has_more: hasMore,
        page_size: upstreamPageSize,
      },
      dateRange: { from, to },
    });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;

    const message = error?.message || 'Failed to fetch WA Tracker leads';
    const status = message.includes('date') || message.includes('startDate') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
