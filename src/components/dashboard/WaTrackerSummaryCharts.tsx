import { Card } from '@/components/Card';

export type WaTrackerLeadGroup = {
  source?: string | null;
  campaign?: string | null;
  leads?: number | null;
};

export type LeadChartDatum = {
  name: string;
  leads: number;
};

const SOURCE_COLORS = [
  '#0d9488',
  '#14b8a6',
  '#0f766e',
  '#2dd4bf',
  '#059669',
  '#5eead4',
];

function validLeadCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function aggregateLeadGroups(
  groups: WaTrackerLeadGroup[],
  getName: (group: WaTrackerLeadGroup) => string,
) {
  const totals = new Map<string, number>();

  groups.forEach((group) => {
    const name = getName(group);
    totals.set(name, (totals.get(name) || 0) + validLeadCount(group.leads));
  });

  return Array.from(totals, ([name, leads]) => ({ name, leads }))
    .sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
}

export function aggregateLeadsBySource(groups: WaTrackerLeadGroup[]) {
  return aggregateLeadGroups(groups, (group) => group.source?.trim() || 'Unknown');
}

export function aggregateLeadsByCampaign(groups: WaTrackerLeadGroup[]) {
  return aggregateLeadGroups(groups, (group) => group.campaign?.trim() || 'Unattributed');
}

export function groupCampaignsForChart(campaigns: LeadChartDatum[], maxRows = 8) {
  if (campaigns.length <= maxRows || maxRows < 2) return campaigns;

  const visibleCampaigns = campaigns.slice(0, maxRows - 1);
  const remainingCampaigns = campaigns.slice(maxRows - 1);

  return [
    ...visibleCampaigns,
    {
      name: `Other campaigns (${remainingCampaigns.length})`,
      leads: remainingCampaigns.reduce((total, campaign) => total + campaign.leads, 0),
    },
  ];
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
}

function SourceComparisonChart({ sources }: { sources: LeadChartDatum[] }) {
  const totalLeads = sources.reduce((total, source) => total + source.leads, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const segments = sources.reduce<Array<{
    source: LeadChartDatum;
    segmentLength: number;
    dashOffset: number;
  }>>((chartSegments, source) => {
    const segmentLength = totalLeads > 0 ? (source.leads / totalLeads) * circumference : 0;
    const previousLength = chartSegments.reduce((total, segment) => total + segment.segmentLength, 0);

    return [...chartSegments, { source, segmentLength, dashOffset: -previousLength }];
  }, []);

  return (
    <Card className="h-full border-teal-500/10 dark:border-teal-500/20 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Leads by Source</h3>
          <p className="text-xs text-muted mt-1">Share of generated leads by acquisition source</p>
        </div>
        <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-full whitespace-nowrap">
          {sources.length} {sources.length === 1 ? 'source' : 'sources'}
        </span>
      </div>

      {totalLeads > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-[176px_minmax(0,1fr)] items-center gap-7">
          <div className="relative w-44 h-44 mx-auto">
            <svg
              viewBox="0 0 120 120"
              role="img"
              aria-label={`Leads by source. ${sources.map((source) => `${source.name}: ${formatNumber(source.leads)}`).join(', ')}`}
              className="w-full h-full drop-shadow-sm"
            >
              <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" className="text-teal-950/5 dark:text-white/5" strokeWidth="16" />
              {segments.map(({ source, segmentLength, dashOffset }, index) => {
                const gap = Math.min(1.75, segmentLength * 0.2);

                return (
                  <circle
                    key={source.name}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={SOURCE_COLORS[index % SOURCE_COLORS.length]}
                    strokeWidth="16"
                    strokeLinecap="butt"
                    strokeDasharray={`${Math.max(segmentLength - gap, 0)} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 60 60)"
                    className="wa-chart-segment transition-[stroke-width,opacity] duration-200 hover:opacity-80"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <title>{`${source.name}: ${formatNumber(source.leads)} leads (${Math.round((source.leads / totalLeads) * 100)}%)`}</title>
                  </circle>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold tracking-tight text-foreground">{formatNumber(totalLeads)}</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">total leads</span>
            </div>
          </div>

          <ul className="space-y-2.5 min-w-0" aria-label="Lead source breakdown">
            {sources.map((source, index) => {
              const share = totalLeads > 0 ? source.leads / totalLeads : 0;

              return (
                <li key={source.name} className="group flex items-center gap-3 min-w-0 rounded-lg py-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
                    style={{ backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-foreground truncate flex-1" title={source.name}>{source.name}</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{formatNumber(source.leads)}</span>
                  <span className="text-xs text-muted tabular-nums w-10 text-right">{Math.round(share * 100)}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <ChartEmptyState />
      )}
    </Card>
  );
}

function CampaignLeadsChart({ campaigns, totalCampaigns }: { campaigns: LeadChartDatum[]; totalCampaigns: number }) {
  const maxLeads = Math.max(...campaigns.map((campaign) => campaign.leads), 0);
  const totalLeads = campaigns.reduce((total, campaign) => total + campaign.leads, 0);

  return (
    <Card className="h-full border-teal-500/10 dark:border-teal-500/20 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Leads Generated by Campaign</h3>
          <p className="text-xs text-muted mt-1">Campaign ranking for the selected period</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-foreground tabular-nums">{formatNumber(totalLeads)}</p>
          <p className="text-[11px] uppercase tracking-wider text-muted">total leads</p>
        </div>
      </div>

      {maxLeads > 0 ? (
        <ol className="space-y-4" aria-label="Campaign lead ranking">
          {campaigns.map((campaign, index) => {
            const width = (campaign.leads / maxLeads) * 100;

            return (
              <li key={campaign.name} title={`${campaign.name}: ${formatNumber(campaign.leads)} leads`}>
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="text-[11px] font-semibold text-muted tabular-nums w-4">{index + 1}</span>
                  <span className="text-sm font-medium text-foreground truncate flex-1">{campaign.name}</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{formatNumber(campaign.leads)}</span>
                </div>
                <div className="ml-7 h-2 rounded-full bg-teal-950/[0.06] dark:bg-white/[0.06] overflow-hidden" aria-hidden="true">
                  <div
                    className="wa-campaign-bar h-full rounded-full bg-teal-600 dark:bg-teal-500"
                    style={{ width: `${width}%`, animationDelay: `${index * 70}ms` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <ChartEmptyState />
      )}

      {totalCampaigns > campaigns.length && (
        <p className="text-xs text-muted mt-5 pt-4 border-t border-border-custom">
          Smaller campaigns are grouped to keep the comparison readable.
        </p>
      )}
    </Card>
  );
}

function ChartEmptyState() {
  return (
    <div className="min-h-44 flex items-center justify-center rounded-xl border border-dashed border-border-custom bg-accent-custom/40">
      <p className="text-sm text-muted">No lead data for the selected period.</p>
    </div>
  );
}

export function WaTrackerSummaryCharts({ groups }: { groups: WaTrackerLeadGroup[] }) {
  const sources = aggregateLeadsBySource(groups);
  const allCampaigns = aggregateLeadsByCampaign(groups);
  const campaigns = groupCampaignsForChart(allCampaigns);

  return (
    <section aria-label="WA Tracker lead charts" className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      <SourceComparisonChart sources={sources} />
      <CampaignLeadsChart campaigns={campaigns} totalCampaigns={allCampaigns.length} />
    </section>
  );
}
