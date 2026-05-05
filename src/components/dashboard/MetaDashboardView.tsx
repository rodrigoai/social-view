'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/Card';
import { FilterPanel } from '@/components/FilterPanel';
import { KpiLabel, type KpiKey } from '@/components/KpiModal';
import { DollarSign, MousePointerClick, TrendingUp, AlertCircle, Users, Activity, Eye, Heart, MessageCircle } from 'lucide-react';
import Link from 'next/link';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adsError, setAdsError] = useState<any>(null);
  const [fbError, setFbError] = useState<any>(null);
  const [igError, setIgError] = useState<any>(null);

  const handleFilterChange = (newFilters: any) => {
    onFilterChange(newFilters);
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

        // Handle Ads
        if (adsRes.ok) {
          const adsData = await adsRes.json();
          setData(adsData);
          setAdsError(null);
        } else {
          const errorJson = await adsRes.json().catch(() => ({}));
          if (errorJson.code !== 'AUTH_REQUIRED' && errorJson.code !== 'NOT_CONFIGURED') {
            console.error('Meta Ads API Error:', errorJson);
          }
          setAdsError(errorJson);
          setData(null);
          if (errorJson.code !== 'AUTH_REQUIRED') {
            setError(errorJson.message || 'Failed to load Meta Ads data');
          }
        }

        // Handle Facebook Pages
        if (fbRes.ok) {
          const fbDataJson = await fbRes.json();
          setFbData(fbDataJson);
          setFbError(null);
        } else {
          const errorJson = await fbRes.json().catch(() => ({}));
          if (errorJson.code !== 'AUTH_REQUIRED' && errorJson.code !== 'NOT_CONFIGURED') {
            console.error('Facebook Pages API Error:', errorJson);
          }
          setFbError(errorJson);
          setFbData(null);
        }

        // Handle Instagram
        if (igRes.ok) {
          const igDataJson = await igRes.json();
          setIgData(igDataJson);
          setIgError(null);
        } else {
          const errorJson = await igRes.json().catch(() => ({}));
          if (errorJson.code !== 'AUTH_REQUIRED' && errorJson.code !== 'NOT_CONFIGURED') {
            console.error('Instagram API Error:', errorJson);
          }
          setIgError(errorJson);
          setIgData(null);
        }

      } catch (err: any) {
        console.error('Dashboard Load Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [selectedAccountId, filters]);



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
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

  const cpl = data?.summary?.totalConversions > 0 
    ? (data.summary.totalCost / data.summary.totalConversions)
    : 0;

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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="hover:scale-[1.005] transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="metaCost" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5" /> Investimento
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(data?.summary?.totalCost || 0)}</p>
          </Card>
          
          <Card className="hover:scale-[1.005] transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="metaConversions" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" /> Leads
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.summary?.totalConversions || 0)}</p>
          </Card>
          
          <Card className="hover:scale-[1.005] transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="metaCpl" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" /> CPL
            </KpiLabel>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(cpl)}</p>
          </Card>

          <Card className="hover:scale-[1.005] transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
            <KpiLabel kpiKey="metaImpressions" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">{campaign.name}</h3>
                    <p className="text-xs text-muted font-mono mt-0.5 opacity-70">ID: {campaign.id}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
                  <div className="flex flex-col">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Custo
                    </div>
                    <span className="text-xl font-bold text-foreground">{formatCurrency(campaign.cost)}</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Leads
                    </div>
                    <span className="text-xl font-bold text-foreground">{formatNumber(campaign.conversions)}</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> CPL
                    </div>
                    <span className="text-xl font-bold text-foreground">{formatCurrency(campaign.cpl)}</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider inline-flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> Reach
                    </div>
                    <span className="text-xl font-bold text-foreground">{formatNumber(campaign.reach)}</span>
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

      {/* Instagram Pages */}
      {igData && igData.accounts && igData.accounts.length > 0 && (
        <div className="mb-12 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <InstagramLogo />
            <h2 className="text-xl font-bold text-foreground">Instagram</h2>
          </div>
          
          {igData.accounts.map((acc: any) => (
            <Card key={acc.igAccountId} className="hover:scale-[1.005] transition-transform border-pink-500/10 dark:border-pink-500/20 bg-gradient-to-br from-white to-pink-50/30 dark:from-background dark:to-pink-950/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">@{acc.igAccountName}</h3>
                  <p className="text-xs text-muted font-mono mt-1 opacity-70">ID: {acc.igAccountId}</p>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 md:flex-grow md:justify-end">
                  <div className="flex flex-col">
                    <KpiLabel kpiKey="metaReach" onOpen={onOpenKpi} className="text-xs font-medium text-pink-600 dark:text-pink-400 mb-1 uppercase tracking-wider">
                      <Users className="w-3.5 h-3.5" /> Reach
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatNumber(acc.stats.reach)}</span>
                  </div>
                  
                  <div className="flex flex-col">
                    <KpiLabel kpiKey="metaImpressions" onOpen={onOpenKpi} className="text-xs font-medium text-pink-600 dark:text-pink-400 mb-1 uppercase tracking-wider">
                      <Eye className="w-3.5 h-3.5" /> Impressões
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatNumber(acc.stats.impressions)}</span>
                  </div>

                  <div className="flex flex-col">
                    <KpiLabel kpiKey="metaProfileViews" onOpen={onOpenKpi} className="text-xs font-medium text-pink-600 dark:text-pink-400 mb-1 uppercase tracking-wider">
                      <MousePointerClick className="w-3.5 h-3.5" /> Visitas ao Perfil
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatNumber(acc.stats.profileViews)}</span>
                  </div>
                </div>
              </div>
            </Card>
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
            <Card key={page.pageId} className="hover:scale-[1.005] transition-transform border-blue-500/10 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{page.pageName}</h3>
                  <p className="text-xs text-muted font-mono mt-1 opacity-70">ID: {page.pageId}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:flex-grow md:justify-end">
                  <div className="flex flex-col">
                    <KpiLabel kpiKey="metaImpressions" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider">
                      <Eye className="w-3.5 h-3.5" /> Impressões
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatNumber(page.stats.impressions)}</span>
                  </div>
                  
                  <div className="flex flex-col">
                    <KpiLabel kpiKey="metaEngagement" onOpen={onOpenKpi} className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider">
                      <Heart className="w-3.5 h-3.5" /> Engajamento
                    </KpiLabel>
                    <span className="text-xl font-bold text-foreground">{formatNumber(page.stats.engagement)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
