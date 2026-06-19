'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { AlertCircle, ChevronDown, ChevronRight, Loader2, MessageSquareText, RefreshCw } from 'lucide-react';
import { KpiLabel, type KpiKey } from '@/components/KpiModal';

type LeadStatusFilter = 'all' | 'Not Qualified' | 'Proposta' | 'Venda';

type WaTrackerLead = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  source: string;
  campaign: string;
  conversion_time?: string | null;
  conversion_name?: string | null;
  value?: number | null;
  currency?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_medium?: string | null;
  enrichment_status?: string | null;
  google_ads?: Record<string, string | number | null | undefined> | null;
};

type LeadsResponse = {
  data: WaTrackerLead[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    page_size: number;
  };
};

type WaTrackerLeadsTableProps = {
  selectedAccountId: string;
  filters: any;
  onOpenKpi: (key: KpiKey) => void;
};

const STATUS_OPTIONS: Array<{ value: LeadStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'Not Qualified', label: 'Not Qualified' },
  { value: 'Proposta', label: 'Proposta' },
  { value: 'Venda', label: 'Venda' },
];

function getStatusBadgeClass(status: string) {
  if (status === 'Venda') return 'bg-emerald-700 text-white dark:bg-emerald-900/30 dark:text-emerald-300';
  if (status === 'Proposta') return 'bg-amber-700 text-white dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-slate-700 text-white dark:bg-slate-800 dark:text-slate-300';
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function getLeadDateKey(value?: string | null) {
  if (!value) return 'No date';
  const isoDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isOrganicSource(source: string) {
  const normalized = source.trim().toLowerCase();
  return normalized === 'organic' || normalized === 'organico' || normalized === 'orgânico';
}

function getContactLabel(lead: WaTrackerLead) {
  return lead.name || lead.phone || lead.email || 'Unnamed lead';
}

function buildQuery(selectedAccountId: string, filters: any, status: LeadStatusFilter, cursor?: string | null) {
  const queryParams: Record<string, string> = {
    mainAccountId: selectedAccountId,
    period: filters.period,
    campaign: filters.campaign,
    page_size: '50',
  };

  if (filters.period === 'custom' && filters.startDate && filters.endDate) {
    queryParams.startDate = filters.startDate;
    queryParams.endDate = filters.endDate;
  }

  if (status !== 'all') queryParams.status = status;
  if (cursor) queryParams.cursor = cursor;

  return new URLSearchParams(queryParams).toString();
}

export function WaTrackerLeadsTable({ selectedAccountId, filters, onOpenKpi }: WaTrackerLeadsTableProps) {
  const [status, setStatus] = useState<LeadStatusFilter>('all');
  const [leads, setLeads] = useState<WaTrackerLead[]>([]);
  const [pagination, setPagination] = useState<LeadsResponse['pagination'] | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadLeads() {
      setLoading(true);
      setError(null);
      setExpandedIds([]);

      try {
        const response = await fetch(`/api/wa-tracker/leads?${buildQuery(selectedAccountId, filters, status)}`);
        const payload = await response.json().catch(() => ({}));

        if (!active) return;

        if (!response.ok) {
          setLeads([]);
          setPagination(null);
          setError(payload.message || payload.error || 'Failed to load WA Tracker leads.');
          return;
        }

        setLeads(payload.data || []);
        setPagination(payload.pagination || null);
      } catch (err: any) {
        if (!active) return;
        setLeads([]);
        setPagination(null);
        setError(err.message || 'Failed to load WA Tracker leads.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadLeads();

    return () => {
      active = false;
    };
  }, [selectedAccountId, filters, status, refreshNonce]);

  const loadMore = async () => {
    if (!pagination?.next_cursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const response = await fetch(`/api/wa-tracker/leads?${buildQuery(selectedAccountId, filters, status, pagination.next_cursor)}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.message || payload.error || 'Failed to load more WA Tracker leads.');
        return;
      }

      setLeads((current) => [...current, ...(payload.data || [])]);
      setPagination(payload.pagination || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load more WA Tracker leads.');
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const dailyLeads = useMemo(() => {
    const dailyMap = new Map<string, { date: string; organic: number; ads: number; total: number }>();

    leads.forEach((lead) => {
      const date = getLeadDateKey(lead.conversion_time);
      const current = dailyMap.get(date) || { date, organic: 0, ads: 0, total: 0 };

      if (isOrganicSource(lead.source)) current.organic += 1;
      else current.ads += 1;

      current.total += 1;
      dailyMap.set(date, current);
    });

    return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [leads]);

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Leads</h3>
            <p className="text-xs text-muted">Reverse chronological conversion list</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="inline-flex rounded-lg border border-border-custom bg-card p-1">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  status === option.value
                    ? 'bg-teal-700 text-white'
                    : 'text-muted hover:text-foreground hover:bg-accent-custom'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRefreshNonce((value) => value + 1)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-custom text-foreground hover:bg-accent-custom disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {!loading && !error && dailyLeads.length > 0 && (
        <Card className="mb-6 shadow-sm hover:shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-foreground">Daily Leads</h4>
            {pagination?.has_more && (
              <span className="text-xs text-muted">Loaded leads only</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-custom text-xs uppercase tracking-wider text-muted">
                  <th className="py-3 pr-4 text-left font-semibold">Date</th>
                  <th className="py-3 pr-4 text-right font-semibold">Organic</th>
                  <th className="py-3 pr-4 text-right font-semibold">Ads</th>
                  <th className="py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {dailyLeads.map((day) => (
                  <tr key={day.date} className="border-b border-border-custom last:border-0">
                    <td className="py-3 pr-4 font-medium text-foreground">{day.date === 'No date' ? 'No date' : formatDate(day.date)}</td>
                    <td className="py-3 pr-4 text-right text-foreground">{day.organic}</td>
                    <td className="py-3 pr-4 text-right text-foreground">{day.ads}</td>
                    <td className="py-3 text-right font-semibold text-foreground">{day.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="shadow-sm hover:shadow-sm overflow-hidden">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-muted">No leads found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-custom text-xs uppercase tracking-wider text-muted">
                  <th className="w-10 py-3 pr-3 text-left" />
                  <th className="py-3 pr-4 text-left font-semibold">Lead</th>
                  <th className="py-3 pr-4 text-left font-semibold">
                    <KpiLabel kpiKey="waLeadStatus" onOpen={onOpenKpi} className="text-xs uppercase tracking-wider text-muted">
                      Status
                    </KpiLabel>
                  </th>
                  <th className="py-3 pr-4 text-left font-semibold">
                    <KpiLabel kpiKey="waConversion" onOpen={onOpenKpi} className="text-xs uppercase tracking-wider text-muted">
                      Conversion
                    </KpiLabel>
                  </th>
                  <th className="py-3 pr-4 text-left font-semibold">
                    <KpiLabel kpiKey="waSource" onOpen={onOpenKpi} className="text-xs uppercase tracking-wider text-muted">
                      Source
                    </KpiLabel>
                  </th>
                  <th className="py-3 pr-4 text-left font-semibold">
                    <KpiLabel kpiKey="waCampaign" onOpen={onOpenKpi} className="text-xs uppercase tracking-wider text-muted">
                      Campaign
                    </KpiLabel>
                  </th>
                  <th className="py-3 pr-4 text-left font-semibold">
                    <KpiLabel kpiKey="waMedium" onOpen={onOpenKpi} className="text-xs uppercase tracking-wider text-muted">
                      Medium
                    </KpiLabel>
                  </th>
                  <th className="py-3 text-left font-semibold">
                    <KpiLabel kpiKey="waEnrichment" onOpen={onOpenKpi} className="text-xs uppercase tracking-wider text-muted">
                      Enrichment
                    </KpiLabel>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const expanded = expandedIds.includes(lead.id);
                  return (
                    <tr key={lead.id} className="border-b border-border-custom last:border-0 align-top">
                      <td className="py-4 pr-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(lead.id)}
                          className="p-1 rounded-md text-muted hover:text-foreground hover:bg-accent-custom"
                          aria-label={expanded ? 'Collapse lead details' : 'Expand lead details'}
                        >
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="py-4 pr-4">
                        <p className="font-semibold text-foreground">{getContactLabel(lead)}</p>
                        <p className="text-xs text-muted">{[lead.phone, lead.email].filter(Boolean).join(' · ') || lead.id}</p>
                        {expanded && <LeadDetails lead={lead} onOpenKpi={onOpenKpi} />}
                      </td>
                      <td className="py-4 pr-4">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusBadgeClass(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <p className="text-foreground">{formatDateTime(lead.conversion_time)}</p>
                        <p className="text-xs text-muted">{lead.conversion_name || '—'}</p>
                      </td>
                      <td className="py-4 pr-4 text-foreground">{lead.source}</td>
                      <td className="py-4 pr-4 max-w-60 truncate text-foreground" title={lead.campaign}>{lead.campaign}</td>
                      <td className="py-4 pr-4 text-foreground">{lead.utm_medium || '—'}</td>
                      <td className="py-4 text-foreground">{lead.enrichment_status || 'Pending'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pagination?.has_more && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
              Load more
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

function LeadDetails({ lead, onOpenKpi }: { lead: WaTrackerLead; onOpenKpi: (key: KpiKey) => void }) {
  const googleAds = lead.google_ads || {};
  const detailItems: Array<[string, unknown, KpiKey?]> = [
    ['Lead ID', lead.id],
    ['UTM Source', lead.utm_source],
    ['UTM Medium', lead.utm_medium],
    ['UTM Campaign', lead.utm_campaign],
    ['GCLID', googleAds.gclid, 'waGclid'],
    ['GBRAID', googleAds.gbraid, 'waGbraid'],
    ['WBRAID', googleAds.wbraid, 'waWbraid'],
    ['Campaign ID', googleAds.campaign_id],
    ['Ad Group', googleAds.ad_group_name],
    ['Keyword', googleAds.gclid_keyword, 'waKeyword'],
    ['Match Type', googleAds.gclid_match_type, 'waMatchType'],
    ['Click Date', googleAds.gclid_click_date],
    ['Network', googleAds.gclid_ad_network_type, 'waNetwork'],
    ['Geo Interest', [googleAds.gclid_geo_interest_region, googleAds.gclid_geo_interest_country].filter(Boolean).join(', ')],
    ['Geo Presence', [googleAds.gclid_geo_presence_region, googleAds.gclid_geo_presence_country].filter(Boolean).join(', ')],
  ];
  const visibleDetailItems = detailItems.filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3 rounded-xl border border-border-custom bg-accent-custom/40 p-4">
      {visibleDetailItems.map(([label, value, kpiKey]) => (
        <div key={label as string} className="min-w-0">
          {kpiKey ? (
            <KpiLabel kpiKey={kpiKey} onOpen={onOpenKpi} className="text-[11px] uppercase tracking-wider text-muted font-semibold">
              {label}
            </KpiLabel>
          ) : (
            <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">{label}</p>
          )}
          <p className="text-xs text-foreground break-words">{String(value)}</p>
        </div>
      ))}
    </div>
  );
}
