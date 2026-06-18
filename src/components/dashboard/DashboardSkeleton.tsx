import { Card } from '@/components/Card';

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`rounded-md bg-accent-custom ${className}`} />;
}

function FilterSkeleton() {
  return (
    <div className="mb-10 rounded-2xl border border-border-custom bg-card p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
        </div>
        <SkeletonBlock className="h-11 w-full rounded-xl md:w-32" />
        <SkeletonBlock className="h-11 w-full rounded-xl md:w-28" />
      </div>
    </div>
  );
}

function SectionHeadingSkeleton() {
  return (
    <div className="mb-4 flex items-center gap-3">
      <SkeletonBlock className="h-6 w-6 rounded-lg" />
      <SkeletonBlock className="h-6 w-36" />
    </div>
  );
}

function KpiGridSkeleton() {
  return (
    <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="shadow-sm hover:shadow-sm">
          <SkeletonBlock className="mb-3 h-3 w-24" />
          <SkeletonBlock className="h-8 w-32" />
        </Card>
      ))}
    </div>
  );
}

function ResultRowsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="h-5 w-32" />
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index} className="shadow-sm hover:shadow-sm">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10 flex-shrink-0 rounded-xl" />
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-44" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-8">
              {Array.from({ length: 3 }, (_, metricIndex) => (
                <div key={metricIndex} className="space-y-2">
                  <SkeletonBlock className="h-3 w-16" />
                  <SkeletonBlock className="h-6 w-20" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function DashboardSkeleton({ variant }: { variant: 'google' | 'meta' | 'wa-tracker' }) {
  const label = variant === 'google' ? 'Google' : variant === 'meta' ? 'Meta' : 'WA Tracker';

  return (
    <div
      className="animate-pulse"
      role="status"
      aria-label={`Loading ${label} dashboard`}
      data-testid={`${variant}-dashboard-skeleton`}
    >
      {variant === 'google' && (
        <Card className="mb-8 shadow-sm hover:shadow-sm">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-8 w-8 rounded-lg" />
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="h-3 w-56" />
            </div>
          </div>
        </Card>
      )}

      <FilterSkeleton />

      <div className="mb-10">
        <SectionHeadingSkeleton />
        <KpiGridSkeleton />
        <ResultRowsSkeleton />
      </div>

      <span className="sr-only">Loading dashboard data...</span>
    </div>
  );
}

export function PageSpeedSkeleton() {
  return (
    <div
      className="animate-pulse space-y-8"
      role="status"
      aria-label="Loading PageSpeed Insights"
      data-testid="pagespeed-skeleton"
    >
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-52" />
        <SkeletonBlock className="h-3 w-64 max-w-full" />
      </div>

      {['mobile', 'desktop'].map((strategy) => (
        <div key={strategy} className="space-y-4">
          <SkeletonBlock className="h-3 w-16" />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex flex-col items-center gap-3">
                <SkeletonBlock className="h-20 w-20 rounded-full" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <span className="sr-only">Loading PageSpeed Insights...</span>
    </div>
  );
}
