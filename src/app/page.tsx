"use client";

import { useState } from 'react';
import { KpiModal, type KpiKey } from '@/components/KpiModal';
import { useAccount } from '@/context/AccountContext';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { GoogleDashboardView } from '@/components/dashboard/GoogleDashboardView';
import { MetaDashboardView } from '@/components/dashboard/MetaDashboardView';
import { WaTrackerDashboardView } from '@/components/dashboard/WaTrackerDashboardView';

export default function Dashboard() {
  const { selectedAccountId, selectedAccount, isLoading: accountsLoading } = useAccount();
  const [openKpi, setOpenKpi] = useState<KpiKey | null>(null);
  const [activeTab, setActiveTab] = useState<'google' | 'meta' | 'wa-tracker'>('google');
  const [filters, setFilters] = useState({ 
    period: '7d', 
    campaign: 'all',
    startDate: '',
    endDate: ''
  });

  if (accountsLoading) {
    return <DashboardSkeleton variant="google" />;
  }

  if (!selectedAccountId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <h2 className="text-2xl font-bold mb-2">Welcome to SocialView</h2>
        <p className="text-muted">Please select or add an account in the settings to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted mt-1">Overview of your marketing performance.</p>
      </div>

      {/* Tab Switcher */}
      <div className="grid grid-cols-3 p-1 mb-8 bg-card border border-border-custom rounded-xl w-full max-w-lg">
        <button
          onClick={() => setActiveTab('google')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'google'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-muted hover:text-foreground hover:bg-accent-custom'
          }`}
        >
          Google
        </button>
        <button
          onClick={() => setActiveTab('meta')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'meta'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-muted hover:text-foreground hover:bg-accent-custom'
          }`}
        >
          Meta
        </button>
        <button
          onClick={() => setActiveTab('wa-tracker')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'wa-tracker'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-muted hover:text-foreground hover:bg-accent-custom'
          }`}
        >
          WA Tracker
        </button>
      </div>

      {activeTab === 'google' ? (
        <GoogleDashboardView 
          selectedAccountId={selectedAccountId} 
          selectedAccount={selectedAccount} 
          onOpenKpi={setOpenKpi} 
          filters={filters}
          onFilterChange={setFilters}
        />
      ) : activeTab === 'meta' ? (
        <MetaDashboardView 
          selectedAccountId={selectedAccountId} 
          onOpenKpi={setOpenKpi} 
          filters={filters}
          onFilterChange={setFilters}
        />
      ) : (
        <WaTrackerDashboardView
          selectedAccountId={selectedAccountId}
          onOpenKpi={setOpenKpi}
          filters={filters}
          onFilterChange={setFilters}
        />
      )}

      <KpiModal kpiKey={openKpi} onClose={() => setOpenKpi(null)} />
    </div>
  );
}
