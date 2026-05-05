"use client";

import { useState } from 'react';
import { KpiModal, type KpiKey } from '@/components/KpiModal';
import { useAccount } from '@/context/AccountContext';
import { GoogleDashboardView } from '@/components/dashboard/GoogleDashboardView';
import { MetaDashboardView } from '@/components/dashboard/MetaDashboardView';

export default function Dashboard() {
  const { selectedAccountId, selectedAccount, isLoading: accountsLoading } = useAccount();
  const [openKpi, setOpenKpi] = useState<KpiKey | null>(null);
  const [activeTab, setActiveTab] = useState<'google' | 'meta'>('google');

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
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
      <div className="flex p-1 mb-8 bg-card border border-border-custom rounded-xl w-full max-w-sm">
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
      </div>

      {activeTab === 'google' ? (
        <GoogleDashboardView 
          selectedAccountId={selectedAccountId} 
          selectedAccount={selectedAccount} 
          onOpenKpi={setOpenKpi} 
        />
      ) : (
        <MetaDashboardView 
          selectedAccountId={selectedAccountId} 
          onOpenKpi={setOpenKpi} 
        />
      )}

      <KpiModal kpiKey={openKpi} onClose={() => setOpenKpi(null)} />
    </div>
  );
}
