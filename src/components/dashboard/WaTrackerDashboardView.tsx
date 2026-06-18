'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { FilterPanel } from '@/components/FilterPanel';
import { AlertCircle, CheckCircle2, MessageSquareText, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { clearDashboardCache, getDashboardCacheKey, readDashboardCache, writeDashboardCache } from '@/lib/dashboardClientCache';
import { WaTrackerLeadsTable } from '@/components/dashboard/WaTrackerLeadsTable';
import { KpiLabel, type KpiKey } from '@/components/KpiModal';

type WaTrackerDashboardViewProps = {
  selectedAccountId: string;
  onOpenKpi: (key: KpiKey) => void;
  filters: any;
  onFilterChange: (filters: any) => void;
};

function uniqueCampaigns(campaigns: Array<{ name?: string | null }>) {
  return Array.from(new Set(campaigns.map((campaign) => campaign.name).filter(Boolean) as string[]));
}

function formatDateRange(dateRange?: { from?: string; to?: string }) {
  if (!dateRange?.from || !dateRange?.to) return null;

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const from = new Date(`${dateRange.from}T00:00:00`);
  const to = new Date(`${dateRange.to}T00:00:00`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return `${formatter.format(from)} - ${formatter.format(to)}`;
}

export function WaTrackerDashboardView({ selectedAccountId, onOpenKpi, filters, onFilterChange }: WaTrackerDashboardViewProps) {
  const [data, setData] = useState<any>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const handleRefresh = () => {
    clearDashboardCache(getDashboardCacheKey('wa-tracker', selectedAccountId, filters));
    setRefreshNonce((value) => value + 1);
  };

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!selectedAccountId) return;

      setLoading(true);
      setError(null);

      try {
        const cacheKey = getDashboardCacheKey('wa-tracker', selectedAccountId, filters);
        const cached = readDashboardCache<any>(cacheKey);

        if (cached) {
          if (!active) return;
          setData(cached.data);
          return;
        }

        const queryParams: Record<string, string> = {
          mainAccountId: selectedAccountId,
          period: filters.period,
          campaign: filters.campaign,
        };

        if (filters.period === 'custom' && filters.startDate && filters.endDate) {
          queryParams.startDate = filters.startDate;
          queryParams.endDate = filters.endDate;
        }

        const response = await fetch(`/api/wa-tracker/dashboard?${new URLSearchParams(queryParams).toString()}`);
        if (!active) return;

        if (response.ok) {
          const nextData = await response.json();
          setData(nextData);
          writeDashboardCache(cacheKey, { data: nextData });
        } else {
          const nextError = await response.json().catch(() => ({}));
          setError(nextError);
          setData(null);
        }
      } catch (err: any) {
        if (!active) return;
        setError({ error: err.message || 'Failed to load WA Tracker data' });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [selectedAccountId, filters, refreshNonce]);

  const campaignNames = useMemo(() => uniqueCampaigns(data?.campaignOptions || data?.campaigns || []), [data]);
  const formattedDateRange = formatDateRange(data?.dateRange);

  if (loading) {
    return <DashboardSkeleton variant="wa-tracker" />;
  }

  const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value || 0);
  const formatDecimal = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0);
  const formatPercent = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value || 0);

  if (error) {
    const notConfigured = error.code === 'NOT_CONFIGURED';

    return (
      <div className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-2xl flex items-start gap-4 shadow-sm">
        <AlertCircle className="w-6 h-6 mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="text-lg font-semibold">WA Tracker Unavailable</h2>
          <p className="mt-1 text-red-500 mb-4">
            {error.message || error.error || 'Failed to load WA Tracker data.'}
          </p>
          {notConfigured && (
            <Link href="/settings" className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
              Go to Settings
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <FilterPanel
        onFilterChange={onFilterChange}
        campaigns={campaignNames}
        currentPeriod={filters.period}
        currentCampaign={filters.campaign}
        currentStartDate={filters.startDate}
        currentEndDate={filters.endDate}
        onRefresh={handleRefresh}
        refreshing={loading}
      />

      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">WA Tracker</h2>
            {formattedDateRange && (
              <p className="text-xs text-muted">{formattedDateRange}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
          <Card className="hover:scale-[1.005] transition-transform border-teal-500/10 dark:border-teal-500/20 bg-gradient-to-br from-white to-teal-50/30 dark:from-background dark:to-teal-950/5">
            <KpiLabel kpiKey="waLeads" onOpen={onOpenKpi} className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-2 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" /> Leads
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.summary?.totalLeads)}</p>
          </Card>
          <Card className="hover:scale-[1.005] transition-transform border-teal-500/10 dark:border-teal-500/20 bg-gradient-to-br from-white to-teal-50/30 dark:from-background dark:to-teal-950/5">
            <KpiLabel kpiKey="waAvgLeadsPerDay" onOpen={onOpenKpi} className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-2 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" /> Avg Leads/Day
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatDecimal(data?.summary?.avgLeadsPerDay)}</p>
          </Card>
          <Card className="hover:scale-[1.005] transition-transform border-teal-500/10 dark:border-teal-500/20 bg-gradient-to-br from-white to-teal-50/30 dark:from-background dark:to-teal-950/5">
            <KpiLabel kpiKey="waProposals" onOpen={onOpenKpi} className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-2 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" /> Proposals
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.summary?.totalProposals)}</p>
          </Card>
          <Card className="hover:scale-[1.005] transition-transform border-teal-500/10 dark:border-teal-500/20 bg-gradient-to-br from-white to-teal-50/30 dark:from-background dark:to-teal-950/5">
            <KpiLabel kpiKey="waSales" onOpen={onOpenKpi} className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-2 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sales
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.summary?.totalSales)}</p>
          </Card>
          <Card className="hover:scale-[1.005] transition-transform border-teal-500/10 dark:border-teal-500/20 bg-gradient-to-br from-white to-teal-50/30 dark:from-background dark:to-teal-950/5">
            <KpiLabel kpiKey="waSalesRate" onOpen={onOpenKpi} className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-2 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" /> Sales Rate
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatPercent(data?.summary?.salesRate)}</p>
          </Card>
        </div>

        <h3 className="text-lg font-bold text-foreground mb-4">Campaign Results</h3>
        <div className="grid grid-cols-1 gap-4">
          {data?.campaigns?.map((campaign: any) => (
            <Card key={campaign.id} className="hover:scale-[1.005] transition-transform border-teal-500/10 dark:border-teal-500/20 bg-gradient-to-br from-white to-teal-50/30 dark:from-background dark:to-teal-950/5">
              <div className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_96px_112px_96px_112px] items-center gap-x-6 gap-y-4 md:gap-x-8">
                <div className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center flex-shrink-0">
                    <MessageSquareText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">{campaign.campaign}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {campaign.source}{campaign.campaignId ? ` · ID: ${campaign.campaignId}` : ''}
                    </p>
                  </div>
                </div>
                <Metric label="Leads" value={formatNumber(campaign.leads)} kpiKey="waCampaignLeads" onOpenKpi={onOpenKpi} />
                <Metric label="Proposals" value={formatNumber(campaign.proposals)} kpiKey="waCampaignProposals" onOpenKpi={onOpenKpi} />
                <Metric label="Sales" value={formatNumber(campaign.sales)} kpiKey="waCampaignSales" onOpenKpi={onOpenKpi} />
                <Metric label="Proposal Rate" value={formatPercent(campaign.proposalRate)} kpiKey="waProposalRate" onOpenKpi={onOpenKpi} />
              </div>
            </Card>
          ))}
          {data?.campaigns?.length === 0 && (
            <p className="text-muted">No WA Tracker results found for the selected period.</p>
          )}
        </div>

        <WaTrackerLeadsTable selectedAccountId={selectedAccountId} filters={filters} onOpenKpi={onOpenKpi} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  kpiKey,
  onOpenKpi,
}: {
  label: string;
  value: string;
  kpiKey: KpiKey;
  onOpenKpi: (key: KpiKey) => void;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <KpiLabel kpiKey={kpiKey} onOpen={onOpenKpi} className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-1 uppercase tracking-wider">
        {label}
      </KpiLabel>
      <span className="text-xl font-bold text-foreground whitespace-nowrap">{value}</span>
    </div>
  );
}
