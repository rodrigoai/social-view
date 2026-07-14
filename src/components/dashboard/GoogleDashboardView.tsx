'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/Card';
import { DashboardSkeleton, PageSpeedSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { FilterPanel } from '@/components/FilterPanel';
import { KpiLabel, type KpiKey } from '@/components/KpiModal';
import { DollarSign, MousePointerClick, TrendingUp, AlertCircle, Users, Activity, Timer, MousePointer2, Globe, Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import {
  clearDashboardCache,
  getDashboardCacheKey,
  getPageSpeedCacheKey,
  readDashboardCache,
  writeDashboardCache,
  writePageSpeedCache
} from '@/lib/dashboardClientCache';

function PageSpeedScoreGauge({ label, score }: { label: string; score: number | null }) {
  const normalizedScore = typeof score === 'number' ? Math.max(0, Math.min(score, 100)) : null;
  const color = normalizedScore == null
    ? 'rgb(148 163 184)'
    : normalizedScore >= 90
      ? 'rgb(34 197 94)'
      : normalizedScore >= 50
        ? 'rgb(249 115 22)'
        : 'rgb(239 68 68)';
  const circumference = 2 * Math.PI * 31;
  const offset = normalizedScore == null ? circumference : circumference * (1 - normalizedScore / 100);

  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r="31" fill="none" stroke="currentColor" strokeWidth="5" className="text-accent-custom" />
          <circle
            cx="40"
            cy="40"
            r="31"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
          {normalizedScore ?? '—'}
        </span>
      </div>
      <p className="text-sm font-medium text-foreground text-center leading-snug max-w-28">{label}</p>
    </div>
  );
}

function PageSpeedScoreGroup({ title, scores }: { title: string; scores: Array<{ key: string; label: string; score: number | null }> }) {
  if (!scores || scores.length === 0) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-muted uppercase tracking-wider">{title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {scores.map((item) => (
          <PageSpeedScoreGauge key={item.key} label={item.label} score={item.score} />
        ))}
      </div>
    </div>
  );
}

export function GoogleDashboardView({
  selectedAccountId,
  selectedAccount,
  onOpenKpi,
  filters,
  onFilterChange
}: {
  selectedAccountId: string;
  selectedAccount: any;
  onOpenKpi: (key: KpiKey) => void;
  filters: any;
  onFilterChange: (filters: any) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [gaData, setGaData] = useState<any>(null);
  const [scData, setScData] = useState<any>(null);
  const [pageSpeedData, setPageSpeedData] = useState<any>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageSpeedLoading, setPageSpeedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adsError, setAdsError] = useState<any>(null);
  const [gaError, setGaError] = useState<any>(null);
  const [scError, setScError] = useState<any>(null);
  const [pageSpeedError, setPageSpeedError] = useState<any>(null);

  const handleFilterChange = (newFilters: any) => {
    onFilterChange(newFilters);
  };

  const handleRefresh = () => {
    clearDashboardCache(getDashboardCacheKey('google', selectedAccountId, filters));
    clearDashboardCache(getPageSpeedCacheKey(selectedAccountId));
    setRefreshNonce((value) => value + 1);
  };

  useEffect(() => {
    let active = true;

    async function loadPageSpeedData() {
      if (!selectedAccountId) return;

      setPageSpeedLoading(true);
      setPageSpeedError(null);
      setPageSpeedData(null);

      const cacheKey = getPageSpeedCacheKey(selectedAccountId);
      const cached = readDashboardCache<any>(cacheKey);

      if (cached) {
        setPageSpeedData(cached.pageSpeedData);
        setPageSpeedLoading(false);
        return;
      }

      let nextPageSpeedData = null;
      let nextPageSpeedError = null;

      try {
        const query = new URLSearchParams({ mainAccountId: selectedAccountId });
        const response = await fetch(`/api/pagespeed/dashboard?${query.toString()}`);

        if (response.ok) {
          nextPageSpeedData = await response.json();
        } else {
          nextPageSpeedError = await response.json().catch(() => ({}));
          console.error('PageSpeed Insights API Error:', nextPageSpeedError);
        }
      } catch (err: any) {
        nextPageSpeedError = { error: err.message || 'Failed to load PageSpeed Insights data.' };
        console.error('PageSpeed Insights Load Error:', err);
      }

      if (!active) return;

      setPageSpeedData(nextPageSpeedData);
      setPageSpeedError(nextPageSpeedError);
      setPageSpeedLoading(false);
      if (nextPageSpeedData) {
        writePageSpeedCache(cacheKey, { pageSpeedData: nextPageSpeedData });
      }
    }

    loadPageSpeedData();

    return () => {
      active = false;
    };
  }, [selectedAccountId, refreshNonce]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!selectedAccountId) return;

      setLoading(true);
      setError(null);
      setAdsError(null);
      setGaError(null);
      setScError(null);
      
      try {
        const cacheKey = getDashboardCacheKey('google', selectedAccountId, filters);
        const cached = readDashboardCache<any>(cacheKey);

        const queryParams: any = {
          mainAccountId: selectedAccountId,
          period: filters.period,
          campaign: filters.campaign
        };

        if (filters.period === 'custom' && filters.startDate && filters.endDate) {
          queryParams.startDate = filters.startDate;
          queryParams.endDate = filters.endDate;
        }
        
        const query = new URLSearchParams(queryParams);

        if (cached) {
          if (!active) return;
          setData(cached.data);
          setGaData(cached.gaData);
          setScData(cached.scData);
          setAdsError(cached.adsError || null);
          setGaError(cached.gaError || null);
          setScError(cached.scError || null);
          return;
        }

        const [adsRes, gaRes, scRes] = await Promise.all([
          fetch(`/api/ads/campaigns?${query.toString()}`),
          fetch(`/api/analytics/dashboard?${query.toString()}`),
          fetch(`/api/search-console/dashboard?${query.toString()}`)
        ]);
        if (!active) return;

        let nextData = null;
        let nextGaData = null;
        let nextScData = null;
        let nextAdsError = null;
        let nextGaError = null;
        let nextScError = null;

        // Handle Ads
        if (adsRes.ok) {
          nextData = await adsRes.json();
          setData(nextData);
          setAdsError(null);
        } else {
          nextAdsError = await adsRes.json().catch(() => ({}));
          if (nextAdsError.code !== 'AUTH_REQUIRED' && nextAdsError.code !== 'NOT_CONFIGURED') {
            console.error('Ads API Error:', nextAdsError);
          }
          setAdsError(nextAdsError);
          setData(null);
          if (nextAdsError.code !== 'AUTH_REQUIRED') {
            setError(nextAdsError.message || 'Failed to load Ads data');
          }
        }

        // Handle Analytics
        if (gaRes.ok) {
          nextGaData = await gaRes.json();
          setGaData(nextGaData);
          setGaError(null);
        } else {
          nextGaError = await gaRes.json().catch(() => ({}));
          if (nextGaError.code !== 'AUTH_REQUIRED' && nextGaError.code !== 'NOT_CONFIGURED') {
            console.error('Analytics API Error:', nextGaError);
          }
          setGaError(nextGaError);
          setGaData(null);
        }

        // Handle Search Console
        if (scRes.ok) {
          nextScData = await scRes.json();
          setScData(nextScData);
          setScError(null);
        } else {
          nextScError = await scRes.json().catch(() => ({}));
          if (nextScError.code !== 'AUTH_REQUIRED') {
            console.error('Search Console API Error:', nextScError);
          }
          setScError(nextScError);
          setScData(null);
        }

        writeDashboardCache(cacheKey, {
          data: nextData,
          gaData: nextGaData,
          scData: nextScData,
          adsError: nextAdsError,
          gaError: nextGaError,
          scError: nextScError
        });

      } catch (err: any) {
        if (!active) return;
        console.error('Dashboard Load Error:', err);
        setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    
    loadData();

    return () => {
      active = false;
    };
  }, [selectedAccountId, filters, refreshNonce]);



  if (loading) {
    return <DashboardSkeleton variant="google" />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-2xl flex items-start gap-4 shadow-sm">
        <AlertCircle className="w-6 h-6 mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="text-lg font-semibold">Dashboard Unavailable</h2>
          <p className="mt-1 text-red-500 mb-4">{error}</p>
          <Link href="/settings" className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
  };

  const formatConversion = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatInteger = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value);
  };

  const cpa = data?.summary?.totalConversions > 0 
    ? (data.summary.totalCost / data.summary.totalConversions)
    : 0;

  const getStatusBadge = (status: string | number) => {
    const statusMap: Record<string | number, { label: string; color: string }> = {
      'ELIGIBLE': { label: 'Qualificada', color: 'bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
      2: { label: 'Qualificada', color: 'bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
      
      'LEARNING': { label: 'Em Aprendizado', color: 'bg-blue-700 text-white border-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' },
      10: { label: 'Em Aprendizado', color: 'bg-blue-700 text-white border-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' },
      
      'LEARNING_OPTIMIZING': { label: 'Aprendizado (Otimizando)', color: 'bg-blue-700 text-white border-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' },
      11: { label: 'Aprendizado (Otimizando)', color: 'bg-blue-700 text-white border-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' },
      
      'LIMITED': { label: 'Limitada pelo Orçamento', color: 'bg-amber-700 text-white border-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
      8: { label: 'Limitada pelo Orçamento', color: 'bg-amber-700 text-white border-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
      9: { label: 'Limitada pelo Orçamento', color: 'bg-amber-700 text-white border-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
      
      'MISCONFIGURED': { label: 'Incorreta', color: 'bg-red-700 text-white border-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' },
      7: { label: 'Incorreta', color: 'bg-red-700 text-white border-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' },
    };

    const config = statusMap[status] || { label: `Status ${status}`, color: 'bg-gray-700 text-white border-gray-700 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20' };

    return (
      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const GoogleAnalyticsLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-amber-500">
      <path d="M19.5 21C20.3284 21 21 20.3284 21 19.5V11.5C21 10.6716 20.3284 10 19.5 10C18.6716 10 18 10.6716 18 11.5V19.5C18 20.3284 18.6716 21 19.5 21Z" fill="currentColor"/>
      <path d="M12.5 21C13.3284 21 14 20.3284 14 19.5V4.5C14 3.67157 13.3284 3 12.5 3C11.6716 3 11 3.67157 11 4.5V19.5C11 20.3284 11.6716 21 12.5 21Z" fill="currentColor"/>
      <path d="M5.5 21C6.32843 21 7 20.3284 7 19.5V15.5C7 14.6716 6.32843 14 5.5 14C4.67157 14 4 14.6716 4 15.5V19.5C4 20.3284 4.67157 21 5.5 21Z" fill="currentColor"/>
    </svg>
  );

  const GoogleAdsLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L2 21H22L12 3Z" fill="#4285F4"/>
      <path d="M12 3L17 12H7L12 3Z" fill="#FBBC05"/>
      <path d="M12 3L14.5 7.5H9.5L12 3Z" fill="#34A853"/>
    </svg>
  );

  const SearchConsoleLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#34A853"/>
      <circle cx="11" cy="11" r="4" stroke="white" strokeWidth="2" fill="none"/>
      <path d="M14 14L17 17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  const PageSpeedLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-emerald-600">
      <path d="M12 4C7.58 4 4 7.58 4 12C4 14.16 4.86 16.12 6.26 17.56" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M17.74 17.56C19.14 16.12 20 14.16 20 12C20 7.58 16.42 4 12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 12L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  );

  const GoogleBusinessLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#EA4335"/>
      <path d="M12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12H12V10H19V12C19 16.42 15.42 20 12 20C8.13 20 5 16.87 5 13C5 9.13 8.13 6 12 6C13.73 6 15.31 6.6 16.55 7.61L15.13 9.03C14.26 8.39 13.18 8 12 8V7Z" fill="white"/>
    </svg>
  );

  return (
    <div className="animate-in fade-in duration-500">
      {/* Google Business Card */}
      <Card className={`mb-8 border ${
        selectedAccount?.googleBusinessUrl
          ? 'border-orange-200 dark:border-orange-800/40 bg-gradient-to-br from-white to-orange-50/30 dark:from-background dark:to-orange-950/5'
          : 'border-border-custom'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GoogleBusinessLogo />
            <div>
              <h2 className="text-base font-bold text-foreground">Google Business Profile</h2>
              {selectedAccount?.googleBusinessUrl ? (
                <a
                  href={selectedAccount.googleBusinessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 mt-0.5"
                >
                  View Profile <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-sm text-muted mt-0.5">
                  Not linked —{' '}
                  <Link href="/settings" className="text-orange-500 hover:underline">add a link in Settings</Link>
                </p>
              )}
            </div>
          </div>
          {selectedAccount?.googleBusinessUrl && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-orange-600 text-white border border-orange-600 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/40 flex-shrink-0">
              Linked
            </span>
          )}
        </div>
      </Card>

      <FilterPanel 
        onFilterChange={handleFilterChange} 
        campaigns={data?.campaigns?.map((c: any) => c.name) || []} 
        currentPeriod={filters.period}
        currentCampaign={filters.campaign}
        currentStartDate={filters.startDate}
        currentEndDate={filters.endDate}
        onRefresh={handleRefresh}
        refreshing={loading}
      />

      {/* Authentication Required Banner */}
      {(adsError?.code === 'AUTH_REQUIRED' || gaError?.code === 'AUTH_REQUIRED' || scError?.code === 'AUTH_REQUIRED') && (
        <div className="mb-10 p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900">Ação Necessária: Sessão Expirada</h3>
              <p className="text-amber-700 text-sm md:text-base">
                Algumas conexões com o Google expiraram. Reconecte sua conta para restaurar o acesso aos dados de{' '}
                {[
                  adsError?.code === 'AUTH_REQUIRED' && 'Google Ads',
                  gaError?.code === 'AUTH_REQUIRED' && 'Google Analytics',
                  scError?.code === 'AUTH_REQUIRED' && 'Search Console'
                ].filter(Boolean).join(', ')}.
              </p>
            </div>
          </div>
          <Link 
            href={`/api/auth/google?mainAccountId=${selectedAccountId}`} 
            className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-all shadow-md hover:shadow-lg flex-shrink-0 whitespace-nowrap"
          >
            Reconectar Conta
          </Link>
        </div>
      )}

      {gaData && gaData.properties && gaData.properties.length > 0 && (
        <div className="mb-12 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <GoogleAnalyticsLogo />
            <h2 className="text-xl font-bold text-foreground">Google Analytics</h2>
          </div>
          
          {gaData.properties.map((prop: any) => (
            <Card key={prop.propertyId} className="hover:scale-[1.005] transition-transform border-amber-500/10 dark:border-amber-500/20 bg-gradient-to-br from-white to-amber-50/30 dark:from-background dark:to-amber-950/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{prop.propertyName}</h3>
                  <p className="text-xs text-muted font-mono mt-1 opacity-70">ID: {prop.propertyId.replace('properties/', '')}</p>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-4 md:flex-grow md:justify-end">
                  <div className="flex flex-col text-right">
                    <KpiLabel kpiKey="activeUsers" onOpen={onOpenKpi} className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-wider justify-end">
                      <Users className="w-3.5 h-3.5" /> Active Users
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatNumber(prop.stats.activeUsers)}</span>
                  </div>
                  
                  <div className="flex flex-col text-right">
                    <KpiLabel kpiKey="sessions" onOpen={onOpenKpi} className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-wider justify-end">
                      <Activity className="w-3.5 h-3.5" /> Sessions
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatNumber(prop.stats.sessions)}</span>
                  </div>

                  {prop.stats.trackedEventName && (
                    <div className="flex flex-col text-right">
                      <KpiLabel kpiKey="trackedEvent" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider justify-end">
                        <TrendingUp className="w-3.5 h-3.5" /> {prop.stats.trackedEventName}
                      </KpiLabel>
                      <span className="text-xl font-bold text-foreground">{formatNumber(prop.stats.trackedEventCount)}</span>
                    </div>
                  )}
                  
                  <div className="flex flex-col text-right">
                    <KpiLabel kpiKey="bounceRate" onOpen={onOpenKpi} className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-wider justify-end">
                      <MousePointer2 className="w-3.5 h-3.5" /> Bounce Rate
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatPercent(prop.stats.bounceRate)}</span>
                  </div>
                  
                  <div className="flex flex-col text-right">
                    <KpiLabel kpiKey="avgSession" onOpen={onOpenKpi} className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-wider justify-end">
                      <Timer className="w-3.5 h-3.5" /> Avg. Session
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatDuration(prop.stats.averageSessionDuration)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <GoogleAdsLogo />
          <h2 className="text-xl font-bold text-foreground">Google Ads</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <Card className="hover:scale-[1.005] text-right transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="totalCost" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider justify-end">
              <DollarSign className="w-3.5 h-3.5" /> Total Cost
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(data?.summary?.totalCost || 0)}</p>
          </Card>
          <Card className="hover:scale-[1.005] text-right transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="totalConversions" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider justify-end">
              <MousePointerClick className="w-3.5 h-3.5" /> Total Conversions
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.summary?.totalConversions || 0)}</p>
          </Card>
          <Card className="hover:scale-[1.005] text-right transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="totalClicks" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider justify-end">
              <MousePointerClick className="w-3.5 h-3.5" /> Total Clicks
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatInteger(data?.summary?.totalClicks || 0)}</p>
          </Card>
          <Card className="hover:scale-[1.005] text-right transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="costPerConversion" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider justify-end">
              <TrendingUp className="w-3.5 h-3.5" /> Cost Per Conversion
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(cpa)}</p>
          </Card>
        </div>

        <h3 className="text-lg font-bold text-foreground mb-4">Active Campaigns</h3>
        <div className="grid grid-cols-1 gap-4">
          {data?.campaigns?.map((campaign: any) => (
            <Card
              key={campaign.id}
              className="hover:scale-[1.005] transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-bold text-foreground truncate">{campaign.name}</h3>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <p className="text-xs text-muted font-mono mt-0.5 opacity-70">ID: {campaign.id}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 text-right">
                  <div className="flex flex-col">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center justify-end gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Cost
                    </div>
                    <span className="text-xl font-bold text-foreground">{formatCurrency(campaign.cost)}</span>
                  </div>
                  <div className="flex flex-col">
                    <KpiLabel
                      kpiKey="campaignConversions"
                      onOpen={onOpenKpi}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider justify-end"
                    >
                      <MousePointerClick className="w-3.5 h-3.5" /> Conversions
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatConversion(campaign.conversions)}</span>
                  </div>
                  <div className="flex flex-col">
                    <KpiLabel
                      kpiKey="campaignClicks"
                      onOpen={onOpenKpi}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider justify-end"
                    >
                      <MousePointerClick className="w-3.5 h-3.5" /> Clicks
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatInteger(campaign.clicks || 0)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {data?.campaigns?.length === 0 && (
            <p className="text-muted">No campaigns found for the selected period.</p>
          )}
        </div>
      </div>

      {scData && scData.sites && scData.sites.length > 0 && (
        <div className="mb-12 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <SearchConsoleLogo />
            <h2 className="text-xl font-bold text-foreground">Google Search Console</h2>
          </div>

          {scData.sites.map((site: any) => (
            <Card key={site.siteUrl} className="hover:scale-[1.005] transition-transform border-violet-500/10 dark:border-violet-500/20 bg-gradient-to-br from-white to-violet-50/30 dark:from-background dark:to-violet-950/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">{site.siteUrl}</h3>
                    {site.error && (
                      <p className="text-xs text-red-500 mt-0.5">Data unavailable</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                  <div className="flex flex-col text-right">
                    <KpiLabel kpiKey="clicks" onOpen={onOpenKpi} className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1 uppercase tracking-wider justify-end">
                      <MousePointerClick className="w-3.5 h-3.5" /> Clicks
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{new Intl.NumberFormat('pt-BR').format(site.stats.clicks)}</span>
                  </div>

                  <div className="flex flex-col text-right">
                    <KpiLabel kpiKey="impressions" onOpen={onOpenKpi} className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1 uppercase tracking-wider justify-end">
                      <Search className="w-3.5 h-3.5" /> Impressions
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{new Intl.NumberFormat('pt-BR').format(site.stats.impressions)}</span>
                  </div>

                  <div className="flex flex-col text-right">
                    <KpiLabel kpiKey="ctr" onOpen={onOpenKpi} className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1 uppercase tracking-wider justify-end">
                      <TrendingUp className="w-3.5 h-3.5" /> CTR
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatPercent(site.stats.ctr)}</span>
                  </div>

                  <div className="flex flex-col text-right">
                    <KpiLabel kpiKey="avgPosition" onOpen={onOpenKpi} className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1 uppercase tracking-wider justify-end">
                      <Activity className="w-3.5 h-3.5" /> Avg. Position
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{site.stats.position > 0 ? site.stats.position.toFixed(1) : '—'}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-12 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <PageSpeedLogo />
          <h2 className="text-xl font-bold text-foreground">PageSpeed Insights</h2>
        </div>

        <Card className="border-emerald-500/10 dark:border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50/30 dark:from-background dark:to-emerald-950/5">
          {pageSpeedLoading ? (
            <PageSpeedSkeleton />
          ) : pageSpeedData?.configured ? (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-foreground truncate">{pageSpeedData.finalUrl || pageSpeedData.url}</h3>
                  <p className="text-xs text-muted mt-0.5">Mobile and desktop Lighthouse scores</p>
                </div>
                {pageSpeedData.fetchedAt && (
                  <span className="text-xs text-muted flex-shrink-0">
                    {new Date(pageSpeedData.fetchedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="space-y-8">
                <PageSpeedScoreGroup title="Mobile" scores={pageSpeedData.strategies?.mobile?.scores || pageSpeedData.scores || []} />
                <PageSpeedScoreGroup title="Desktop" scores={pageSpeedData.strategies?.desktop?.scores || []} />
              </div>
            </div>
          ) : pageSpeedError ? (
            <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold">PageSpeed Insights unavailable</h3>
                <p className="text-sm mt-1">{pageSpeedError.error || 'Failed to load PageSpeed Insights data.'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Main website not configured</h3>
                <p className="text-sm text-muted mt-1">Add the account website in Settings to enable PageSpeed Insights.</p>
              </div>
              <Link href="/settings" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors flex-shrink-0">
                Settings
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
