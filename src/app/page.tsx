"use client"; 

import { useState, useEffect } from 'react';
import { Card } from '@/components/Card';
import { FilterPanel } from '@/components/FilterPanel';
import { DollarSign, MousePointerClick, TrendingUp, AlertCircle, Users, Activity, Timer, MousePointer2 } from 'lucide-react';
import Link from 'next/link';
import { useAccount } from '@/context/AccountContext';

export default function Dashboard() {
  const { selectedAccountId, isLoading: accountsLoading } = useAccount();
  const [data, setData] = useState<any>(null);
  const [gaData, setGaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gaError, setGaError] = useState<any>(null);


  const [filters, setFilters] = useState({ 
    period: '7d', 
    campaign: 'all',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    async function loadData() {
      if (accountsLoading) return;
      if (!selectedAccountId) {
        setLoading(false);
        setData(null);
        setGaData(null);
        return;
      }

      setLoading(true);
      setError(null);
      setGaError(null);
      
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
        
        const [adsRes, gaRes] = await Promise.all([
          fetch(`/api/ads/campaigns?${query.toString()}`),
          fetch(`/api/analytics/dashboard?${query.toString()}`)
        ]);

        if (!adsRes.ok) {
          const errorText = await adsRes.text();
          console.error('Ads API Error:', errorText);
          throw new Error(`Ads API returned ${adsRes.status}`);
        }

        const adsData = await adsRes.json();
        setData(adsData);

        if (gaRes.ok) {
          const gaDataJson = await gaRes.json();
          setGaData(gaDataJson);
          setGaError(null);
        } else {
          const errorJson = await gaRes.json().catch(() => ({}));
          console.error('Analytics API Error:', errorJson);
          setGaError(errorJson);
          setGaData(null);
        }


      } catch (err: any) {
        console.error('Dashboard Load Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [selectedAccountId, accountsLoading, filters]);

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
  };

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
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
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
      'ELIGIBLE': { label: 'Qualificada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
      2: { label: 'Qualificada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
      '2': { label: 'Qualificada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
      
      'LEARNING': { label: 'Em Aprendizado', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
      10: { label: 'Em Aprendizado', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
      
      'LEARNING_OPTIMIZING': { label: 'Aprendizado (Otimizando)', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
      11: { label: 'Aprendizado (Otimizando)', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
      
      'LIMITED': { label: 'Limitada pelo Orçamento', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
      8: { label: 'Limitada pelo Orçamento', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
      9: { label: 'Limitada pelo Orçamento', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
      '8': { label: 'Limitada pelo Orçamento', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
      '9': { label: 'Limitada pelo Orçamento', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
      
      'MISCONFIGURED': { label: 'Incorreta', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
      7: { label: 'Incorreta', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
    };

    const config = statusMap[status] || { label: `Status ${status}`, color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' };

    return (
      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted mt-1">Overview of your marketing performance.</p>
      </div>

      <FilterPanel 
        onFilterChange={handleFilterChange} 
        campaigns={data?.campaigns?.map((c: any) => c.name) || []} 
        currentPeriod={filters.period}
        currentCampaign={filters.campaign}
        currentStartDate={filters.startDate}
        currentEndDate={filters.endDate}
      />

      {gaError && gaError.code === 'AUTH_REQUIRED' && (
        <div className="mb-10 p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <div>
              <h3 className="text-lg font-bold text-amber-900">Analytics Session Expired</h3>
              <p className="text-amber-700">Please reconnect your Google account to see your analytics data.</p>
            </div>
          </div>
          <Link 
            href={`/api/auth/google?mainAccountId=${selectedAccountId}`} 
            className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-all shadow-sm"
          >
            Reconnect Account
          </Link>
        </div>
      )}

      {gaData && gaData.properties && gaData.properties.length > 0 && (

        <div className="mb-10 space-y-10">
          {gaData.properties.map((prop: any) => (
            <div key={prop.propertyId}>
              <h2 className="text-xl font-bold text-foreground mb-4">Analytics: {prop.propertyName}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card title="Active Users" value={formatNumber(prop.stats.activeUsers)} icon={<Users className="w-6 h-6" />} />
                <Card title="Sessions" value={formatNumber(prop.stats.sessions)} icon={<Activity className="w-6 h-6" />} />
                <Card title="Bounce Rate" value={formatPercent(prop.stats.bounceRate)} icon={<MousePointer2 className="w-6 h-6" />} />
                <Card title="Avg. Session Duration" value={formatDuration(prop.stats.averageSessionDuration)} icon={<Timer className="w-6 h-6" />} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-4">Google Ads</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card title="Total Cost" value={formatCurrency(data?.summary?.totalCost || 0)} icon={<DollarSign className="w-6 h-6" />} />
          <Card title="Total Conversions" value={formatNumber(data?.summary?.totalConversions || 0)} icon={<MousePointerClick className="w-6 h-6" />} />
          <Card title="Cost Per Conversion" value={formatCurrency(cpa)} icon={<TrendingUp className="w-6 h-6" />} />
        </div>

        <h3 className="text-lg font-bold text-foreground mb-4">Active Campaigns</h3>
      <div className="grid grid-cols-1 gap-4">
        {data?.campaigns?.map((campaign: any) => (
          <Card key={campaign.id} className="hover:scale-[1.01] transition-transform">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground">{campaign.name}</h3>
                  {getStatusBadge(campaign.status)}
                </div>
                <p className="text-sm text-muted font-mono text-xs">ID: {campaign.id}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xl font-bold text-foreground">{formatCurrency(campaign.cost)}</p>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-2 py-0.5 rounded-full">{formatNumber(campaign.conversions)} conversions</p>
              </div>
            </div>
          </Card>
        ))}
        {data?.campaigns?.length === 0 && (
          <p className="text-muted">No campaigns found for the selected period.</p>
        )}
      </div>
      </div>
    </div>
  );
}
