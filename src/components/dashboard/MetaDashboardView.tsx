'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/Card';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { FilterPanel } from '@/components/FilterPanel';
import { KpiLabel, type KpiKey } from '@/components/KpiModal';
import { DollarSign, MousePointerClick, TrendingUp, AlertCircle, Users, Activity, Eye, Heart, MessageCircle, Share2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { clearDashboardCache, getDashboardCacheKey, readDashboardCache, writeDashboardCache } from '@/lib/dashboardClientCache';

function mergeFreshInstagramFollowers(cachedIgData: any, freshIgData: any) {
  if (!cachedIgData?.accounts || !freshIgData?.accounts) return cachedIgData;

  const freshAccounts = new Map(
    freshIgData.accounts.map((account: any) => [account.igAccountId, account])
  );

  return {
    ...cachedIgData,
    accounts: cachedIgData.accounts.map((account: any) => {
      const freshAccount: any = freshAccounts.get(account.igAccountId);
      if (!freshAccount) return account;

      return {
        ...account,
        followers: freshAccount.followers,
        followersHistory: freshAccount.followersHistory,
        username: freshAccount.username || account.username
      };
    })
  };
}

function TopContentList({ items, type }: { items: any[], type: 'ig' | 'fb' }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-8">
      <h4 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" /> Top Conteúdo (Engajamento)
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {items.map((item) => (
          <div key={item.id} className="group relative bg-white dark:bg-card border border-border-custom rounded-xl overflow-hidden hover:shadow-lg transition-all">
            <div className="aspect-square relative overflow-hidden bg-muted">
              {item.thumbnail ? (
                <img 
                  src={item.thumbnail} 
                  alt={item.caption || item.message || ''} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  {type === 'ig' ? <Activity className="w-8 h-8 opacity-20" /> : <Users className="w-8 h-8 opacity-20" />}
                </div>
              )}
              <a 
                href={item.permalink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <ExternalLink className="w-6 h-6 text-white" />
              </a>
            </div>
            <div className="p-3">
              <p className="text-xs text-foreground line-clamp-2 mb-3 h-8 leading-relaxed">
                {item.caption || item.message || <span className="italic opacity-50">Sem legenda</span>}
              </p>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tighter text-muted">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5 text-pink-600 dark:text-pink-400">
                    <Heart className="w-3 h-3" /> {item.likes}
                  </span>
                  <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                    <MessageCircle className="w-3 h-3" /> {item.comments}
                  </span>
                  {item.shares !== undefined && (
                    <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                      <Share2 className="w-3 h-3" /> {item.shares}
                    </span>
                  )}
                </div>
                <span className="text-foreground/60">{new Date(item.timestamp || item.createdTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowersHistoryChart({ history }: { history: Array<{ date: string; followers: number }> }) {
  if (!history || history.length === 0) return null;

  const width = 720;
  const height = 180;
  const paddingX = 28;
  const paddingY = 20;
  const values = history.map((point) => point.followers);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const points = history.map((point, index) => {
    const x = paddingX + (history.length === 1 ? plotWidth : (index / (history.length - 1)) * plotWidth);
    const y = paddingY + ((maxValue - point.followers) / range) * plotHeight;
    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const firstPoint = history[0];
  const lastPoint = history[history.length - 1];
  const delta = lastPoint.followers - firstPoint.followers;
  const formatCompact = (value: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const formatExact = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
  const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  return (
    <Card className="border-pink-500/10 dark:border-pink-500/20 shadow-sm hover:shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Histórico de Seguidores</h4>
          <p className="text-xs text-muted mt-1">Últimos 90 dias</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-lg font-bold text-foreground">{formatCompact(lastPoint.followers)}</p>
          <p className={`text-xs font-semibold ${delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {delta >= 0 ? '+' : ''}{formatCompact(delta)}
          </p>
        </div>
      </div>
      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Histórico de seguidores do Instagram nos últimos 90 dias" className="w-full h-48">
          <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="currentColor" className="text-border-custom" strokeWidth="1" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="currentColor" className="text-border-custom" strokeWidth="1" />
          {[0, 0.5, 1].map((step) => {
            const y = paddingY + step * plotHeight;
            const label = Math.round(maxValue - step * range);
            return (
              <g key={step}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" className="text-border-custom/60" strokeWidth="1" strokeDasharray="4 6" />
                <text x="0" y={y + 4} className="fill-muted text-[11px]">{formatCompact(label)}</text>
              </g>
            );
          })}
          <path d={path} fill="none" stroke="rgb(219 39 119)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => {
            const labelY = point.y <= paddingY + 12 ? point.y + 16 : point.y - 9;

            return (
              <g key={`${point.date}-${index}`}>
                <circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 4 : 2.5} fill="rgb(219 39 119)" />
                <text
                  data-testid="followers-history-value-label"
                  x={point.x}
                  y={labelY}
                  textAnchor="middle"
                  className="fill-foreground stroke-card text-[10px] font-semibold"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {formatExact(point.followers)}
                </text>
              </g>
            );
          })}
          <text x={paddingX} y={height - 3} className="fill-muted text-[11px]">{formatDate(firstPoint.date)}</text>
          <text x={width - paddingX} y={height - 3} textAnchor="end" className="fill-muted text-[11px]">{formatDate(lastPoint.date)}</text>
        </svg>
      </div>
    </Card>
  );
}

export function MetaDashboardView({
  selectedAccountId,
  onOpenKpi,
  filters,
  onFilterChange
}: {
  selectedAccountId: string;
  onOpenKpi: (key: KpiKey) => void;
  filters: any;
  onFilterChange: (filters: any) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [fbData, setFbData] = useState<any>(null);
  const [igData, setIgData] = useState<any>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adsError, setAdsError] = useState<any>(null);
  const [fbError, setFbError] = useState<any>(null);
  const [igError, setIgError] = useState<any>(null);

  const handleFilterChange = (newFilters: any) => {
    onFilterChange(newFilters);
  };

  const handleRefresh = () => {
    clearDashboardCache(getDashboardCacheKey('meta', selectedAccountId, filters));
    setRefreshNonce((value) => value + 1);
  };

  useEffect(() => {
    async function loadData() {
      if (!selectedAccountId) return;

      setLoading(true);
      setError(null);
      setAdsError(null);
      setFbError(null);
      setIgError(null);
      
      try {
        const cacheKey = getDashboardCacheKey('meta', selectedAccountId, filters);
        const cached = readDashboardCache<any>(cacheKey);

        if (cached) {
          setData(cached.data);
          setFbData(cached.fbData);
          let refreshedIgData = cached.igData;
          setIgData(refreshedIgData);
          setAdsError(cached.adsError || null);
          setFbError(cached.fbError || null);
          setIgError(cached.igError || null);

          try {
            const followersRes = await fetch(
              `/api/meta/instagram/followers?mainAccountId=${encodeURIComponent(selectedAccountId)}`,
              { cache: 'no-store' }
            );

            if (followersRes.ok) {
              const freshIgData = await followersRes.json();
              refreshedIgData = mergeFreshInstagramFollowers(cached.igData, freshIgData);
              setIgData(refreshedIgData);
              setIgError(null);
              writeDashboardCache(cacheKey, {
                ...cached,
                igData: refreshedIgData,
                igError: null
              });
            } else {
              const followersError = await followersRes.json().catch(() => ({}));
              setIgError(followersError);
            }
          } catch (followersError) {
            console.error('Instagram followers refresh failed:', followersError);
          }
          return;
        }

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
        
        const [adsRes, fbRes, igRes] = await Promise.all([
          fetch(`/api/meta/ads/campaigns?${query.toString()}`),
          fetch(`/api/meta/facebook-pages/dashboard?${query.toString()}`),
          fetch(`/api/meta/instagram/dashboard?${query.toString()}`)
        ]);
        let nextData = null;
        let nextFbData = null;
        let nextIgData = null;
        let nextAdsError = null;
        let nextFbError = null;
        let nextIgError = null;

        // Handle Ads
        if (adsRes.ok) {
          nextData = await adsRes.json();
          setData(nextData);
          setAdsError(null);
        } else {
          nextAdsError = await adsRes.json().catch(() => ({}));
          if (nextAdsError.code !== 'AUTH_REQUIRED' && nextAdsError.code !== 'NOT_CONFIGURED') {
            console.error('Meta Ads API Error:', nextAdsError);
          }
          setAdsError(nextAdsError);
          setData(null);
          if (nextAdsError.code !== 'AUTH_REQUIRED') {
            setError(nextAdsError.message || 'Failed to load Meta Ads data');
          }
        }

        // Handle Facebook Pages
        if (fbRes.ok) {
          nextFbData = await fbRes.json();
          setFbData(nextFbData);
          setFbError(null);
        } else {
          nextFbError = await fbRes.json().catch(() => ({}));
          if (nextFbError.code !== 'AUTH_REQUIRED' && nextFbError.code !== 'NOT_CONFIGURED') {
            console.error('Facebook Pages API Error:', nextFbError);
          }
          setFbError(nextFbError);
          setFbData(null);
        }

        // Handle Instagram
        if (igRes.ok) {
          nextIgData = await igRes.json();
          setIgData(nextIgData);
          setIgError(null);
        } else {
          nextIgError = await igRes.json().catch(() => ({}));
          if (nextIgError.code !== 'AUTH_REQUIRED' && nextIgError.code !== 'NOT_CONFIGURED') {
            console.error('Instagram API Error:', nextIgError);
          }
          setIgError(nextIgError);
          setIgData(null);
        }

        writeDashboardCache(cacheKey, {
          data: nextData,
          fbData: nextFbData,
          igData: nextIgData,
          adsError: nextAdsError,
          fbError: nextFbError,
          igError: nextIgError
        });

      } catch (err: any) {
        console.error('Dashboard Load Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [selectedAccountId, filters, refreshNonce]);



  if (loading) {
    return <DashboardSkeleton variant="meta" />;
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
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const MetaLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-600">
      <path fillRule="evenodd" clipRule="evenodd" d="M12.0001 5.92505C8.98829 5.92505 6.30006 7.64095 5.0934 10.3346C3.88674 13.0283 4.41725 16.143 6.46782 18.3965L7.91578 17.0805C6.4635 15.4851 6.08627 13.2754 6.94086 11.3653C7.79545 9.45524 9.69766 8.24057 11.8315 8.24057C12.7214 8.24057 13.5824 8.49079 14.3315 8.9616L15.655 7.63812C14.6111 6.64379 13.3323 5.92505 12.0001 5.92505ZM18.9067 13.6654C20.1134 10.9717 19.5829 7.85703 17.5323 5.60351L16.0844 6.91953C17.5366 8.51493 17.9139 10.7246 17.0593 12.6347C16.2047 14.5448 14.3025 15.7594 12.1686 15.7594C11.2787 15.7594 10.4177 15.5092 9.66858 15.0384L8.34515 16.3619C9.38902 17.3562 10.6678 18.075 12.0001 18.075C15.0118 18.075 17.6999 16.359 18.9067 13.6654Z" fill="currentColor"/>
    </svg>
  );

  const InstagramLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-pink-600">
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
      <circle cx="18" cy="6" r="1" fill="currentColor"/>
    </svg>
  );

  return (
    <div className="animate-in fade-in duration-500">
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
      {(adsError?.code === 'AUTH_REQUIRED' || fbError?.code === 'AUTH_REQUIRED' || igError?.code === 'AUTH_REQUIRED') && (
        <div className="mb-10 p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900">Ação Necessária: Sessão Expirada</h3>
              <p className="text-amber-700 text-sm md:text-base">
                A conexão com a Meta expirou. Reconecte sua conta para restaurar o acesso aos dados do Facebook e Instagram.
              </p>
            </div>
          </div>
          <Link 
            href={`/settings`} 
            className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-all shadow-md hover:shadow-lg flex-shrink-0 whitespace-nowrap"
          >
            Ir para Configurações
          </Link>
        </div>
      )}

      {/* Meta Ads */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <MetaLogo />
          <h2 className="text-xl font-bold text-foreground">Meta Ads</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card className="hover:scale-[1.005] text-right transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="metaCost" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider justify-end">
              <DollarSign className="w-3.5 h-3.5" /> Investimento
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(data?.summary?.totalCost || 0)}</p>
          </Card>
          
          <Card className="hover:scale-[1.005] text-right transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="metaConversions" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider justify-end">
              <Users className="w-3.5 h-3.5" /> Leads
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.summary?.totalConversions || 0)}</p>
          </Card>

          <Card className="hover:scale-[1.005] text-right transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider inline-flex items-center justify-end gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" /> Conversas
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.summary?.totalMessagingConversationsStarted || 0)}</p>
          </Card>
          
          <Card className="hover:scale-[1.005] text-right transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="metaCostPerResult" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider justify-end">
              <TrendingUp className="w-3.5 h-3.5" /> CPR
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(data?.summary?.totalCostPerResult || 0)}</p>
          </Card>

          <Card className="hover:scale-[1.005] text-right transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="metaImpressions" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider justify-end">
              <Eye className="w-3.5 h-3.5" /> Impressões
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.summary?.totalImpressions || 0)}</p>
          </Card>
        </div>

        <h3 className="text-lg font-bold text-foreground mb-4">Campanhas Ativas</h3>
        <div className="grid grid-cols-1 gap-4">
          {data?.campaigns?.map((campaign: any) => (
            <Card
              key={campaign.id}
              className="hover:scale-[1.005] transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5"
            >
              <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_112px_96px_120px_96px_96px] items-center gap-x-6 gap-y-4 lg:gap-x-8">
                <div className="col-span-2 lg:col-span-1 flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">{campaign.name}</h3>
                    <p className="text-xs text-muted font-mono mt-0.5 opacity-70">ID: {campaign.id}</p>
                  </div>
                </div>
                <div className="flex flex-col min-w-0 text-right">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center justify-end gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" /> Custo
                  </div>
                  <span className="text-xl font-bold text-foreground whitespace-nowrap">{formatCurrency(campaign.cost)}</span>
                </div>
                <div className="flex flex-col min-w-0 text-right">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center justify-end gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Leads
                  </div>
                  <span className="text-xl font-bold text-foreground whitespace-nowrap">{formatNumber(campaign.conversions)}</span>
                </div>
                <div className="flex flex-col min-w-0 text-right">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center justify-end gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> Conversas
                  </div>
                  <span className="text-xl font-bold text-foreground whitespace-nowrap">{formatNumber(campaign.messagingConversationsStarted || 0)}</span>
                </div>
                <div className="flex flex-col min-w-0 text-right">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center justify-end gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> CPR
                  </div>
                  <span className="text-xl font-bold text-foreground whitespace-nowrap">{formatCurrency(campaign.costPerResult || 0)}</span>
                </div>
                <div className="flex flex-col min-w-0 text-right">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center justify-end gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Reach
                  </div>
                  <span className="text-xl font-bold text-foreground whitespace-nowrap">{formatNumber(campaign.reach)}</span>
                </div>
              </div>
            </Card>
          ))}
          {data?.campaigns?.length === 0 && (
            <p className="text-muted">No campaigns found for the selected period.</p>
          )}
        </div>
      </div>

      {/* Instagram Pages */}
      {igData && igData.accounts && igData.accounts.length > 0 && (
        <div className="mb-12 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <InstagramLogo />
            <h2 className="text-xl font-bold text-foreground">Instagram</h2>
          </div>
          
          {igData.accounts.map((acc: any) => (
            <div key={acc.igAccountId} className="space-y-4">
              <Card className="hover:scale-[1.005] transition-transform border-pink-500/10 dark:border-pink-500/20 bg-gradient-to-br from-white to-pink-50/30 dark:from-background dark:to-pink-950/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">@{acc.igAccountName}</h3>
                    <p className="text-xs text-muted font-mono mt-1 opacity-70">ID: {acc.igAccountId}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 text-right md:flex-grow md:justify-end">
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-pink-600 dark:text-pink-400 mb-1 uppercase tracking-wider inline-flex items-center justify-end gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Seguidores
                      </div>
                      <span className="text-xl font-bold text-foreground">{formatNumber(acc.followers)}</span>
                    </div>

                    <div className="flex flex-col">
                      <KpiLabel kpiKey="metaReach" onOpen={onOpenKpi} className="text-xs font-medium text-pink-600 dark:text-pink-400 mb-1 uppercase tracking-wider justify-end">
                        <Users className="w-3.5 h-3.5" /> Reach
                      </KpiLabel>
                      <span className="text-xl font-bold text-foreground">{formatNumber(acc.stats.reach)}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <KpiLabel kpiKey="metaImpressions" onOpen={onOpenKpi} className="text-xs font-medium text-pink-600 dark:text-pink-400 mb-1 uppercase tracking-wider justify-end">
                        <Eye className="w-3.5 h-3.5" /> Impressões
                      </KpiLabel>
                      <span className="text-xl font-bold text-foreground">{formatNumber(acc.stats.impressions)}</span>
                    </div>

                    <div className="flex flex-col">
                      <KpiLabel kpiKey="metaProfileViews" onOpen={onOpenKpi} className="text-xs font-medium text-pink-600 dark:text-pink-400 mb-1 uppercase tracking-wider justify-end">
                        <MousePointerClick className="w-3.5 h-3.5" /> Visitas ao Perfil
                      </KpiLabel>
                      <span className="text-xl font-bold text-foreground">{formatNumber(acc.stats.profileViews)}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <FollowersHistoryChart history={acc.followersHistory} />

              <TopContentList items={acc.topMedia} type="ig" />
            </div>
          ))}
        </div>
      )}

      {/* Facebook Pages */}
      {fbData && fbData.pages && fbData.pages.length > 0 && (
        <div className="mb-12 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <MetaLogo />
            <h2 className="text-xl font-bold text-foreground">Facebook Pages</h2>
          </div>
          
          {fbData.pages.map((page: any) => (
            <div key={page.pageId} className="space-y-4">
              <Card className="hover:scale-[1.005] transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{page.pageName}</h3>
                    <p className="text-xs text-muted font-mono mt-1 opacity-70">ID: {page.pageId}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-right md:flex-grow md:justify-end">
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center justify-end gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Seguidores
                      </div>
                      <span className="text-xl font-bold text-foreground">{formatNumber(page.followers || page.fans)}</span>
                    </div>

                    <div className="flex flex-col">
                      <KpiLabel kpiKey="metaImpressions" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider justify-end">
                        <Eye className="w-3.5 h-3.5" /> Impressões
                      </KpiLabel>
                      <span className="text-xl font-bold text-foreground">{formatNumber(page.stats.impressions)}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <KpiLabel kpiKey="metaEngagement" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider justify-end">
                        <Heart className="w-3.5 h-3.5" /> Engajamento
                      </KpiLabel>
                      <span className="text-xl font-bold text-foreground">{formatNumber(page.stats.engagement)}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <TopContentList items={page.topPosts} type="fb" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
