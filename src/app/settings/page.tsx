"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/Card';
import { CheckCircle2, Link as LinkIcon, Plus, Trash2, Edit2, X, Check, Globe, MapPin, ExternalLink } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';


import { useAccount } from '@/context/AccountContext';

export default function Settings() {
  const { accounts, refreshAccounts } = useAccount();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingBusinessId, setEditingBusinessId] = useState<string | null>(null);
  const [editBusinessUrl, setEditBusinessUrl] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  useEffect(() => {
    if (success || error) {
      refreshAccounts();
      // Clear the query params after a short delay to allow the message to be seen
      const timer = setTimeout(() => {
        router.replace('/settings', { scroll: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error, refreshAccounts, router]);



  const createAccount = async () => {
    const name = window.prompt('Enter account name:', 'My Business Account');
    if (!name) return;

    const res = await fetch('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      await refreshAccounts();
    }
  };

  const deleteAccount = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this account? All linked integrations will be removed.')) return;

    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refreshAccounts();
    }
  };

  const unbindGoogleAds = async (id: string) => {
    if (!window.confirm('Disconnect Google Ads from this account?')) return;

    const res = await fetch(`/api/accounts/${id}/google-ads`, { method: 'DELETE' });
    if (res.ok) {
      await refreshAccounts();
    }
  };

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveName = async (id: string) => {
    if (!editName.trim()) return;

    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: editName })
    });
    
    if (res.ok) {
      await refreshAccounts();
      setEditingId(null);
    }
  };

  const saveBusinessUrl = async (id: string) => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleBusinessUrl: editBusinessUrl.trim() || null })
    });
    if (res.ok) {
      await refreshAccounts();
      setEditingBusinessId(null);
    }
  };

  const linkGoogleAds = (mainAccountId: string) => {
    window.location.href = `/api/auth/google?mainAccountId=${mainAccountId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-muted mt-1">Manage your accounts and integrations.</p>
      </div>

      {success === 'google_linked' && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">Google Ads account successfully linked!</p>
        </div>
      )}

      {success === 'google_analytics_linked' && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">Google Analytics properties successfully linked!</p>
        </div>
      )}

      {success === 'search_console_linked' && (
        <div className="mb-6 p-4 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">Search Console sites successfully linked!</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="font-medium">Integration failed. Please try again.</p>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-foreground">Main Accounts</h2>
        <button 
          onClick={createAccount}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {accounts.map(acc => (
          <Card key={acc.id} className="hover:border-blue-200 dark:hover:border-blue-800 group">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
              <div className="flex-1">
                {editingId === acc.id ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-lg font-bold text-foreground border-b-2 border-blue-600 outline-none bg-transparent py-1 px-0"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && saveName(acc.id)}
                    />
                    <button onClick={() => saveName(acc.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-muted hover:bg-accent-custom rounded">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">{acc.name}</h3>
                    <button 
                      onClick={() => startEditing(acc.id, acc.name)}
                      className="p-1 text-muted hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-sm text-muted font-mono mt-1">ID: {acc.id}</p>
              </div>
              
              <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                {acc.googleCredential ? (
                  <div className="flex flex-col gap-2 w-full">
                    {/* Google Ads Section */}
                    <div className="flex items-center justify-between md:justify-end gap-3 bg-card border border-border-custom p-3 rounded-xl w-full">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium">Ads: {acc.googleAdsConfigs?.length > 0 ? `${acc.googleAdsConfigs.length} connected` : 'Not configured'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => window.location.href = `/settings/google-ads/select?mainAccountId=${acc.id}`}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg transition-colors"
                        >
                          Configure
                        </button>
                      </div>
                    </div>

                    {/* Google Analytics Section */}
                    <div className="flex items-center justify-between md:justify-end gap-3 bg-card border border-border-custom p-3 rounded-xl w-full">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium">Analytics: {acc.googleAnalyticsConfigs?.length > 0 ? `${acc.googleAnalyticsConfigs.length} connected` : 'Not configured'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => window.location.href = `/settings/google-analytics/select?mainAccountId=${acc.id}`}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg transition-colors"
                        >
                          Configure
                        </button>
                      </div>
                    </div>

                    {/* Google Search Console Section */}
                    <div className="flex items-center justify-between md:justify-end gap-3 bg-card border border-border-custom p-3 rounded-xl w-full">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-violet-600" />
                        <span className="text-sm font-medium">Search Console: {acc.googleSearchConsoleConfigs?.length > 0 ? `${acc.googleSearchConsoleConfigs.length} site(s)` : 'Not configured'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => window.location.href = `/settings/google-search-console/select?mainAccountId=${acc.id}`}
                          className="px-3 py-1.5 text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400 rounded-lg transition-colors"
                        >
                          Configure
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => linkGoogleAds(acc.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-card border border-border-custom hover:bg-accent-custom hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-800 text-foreground rounded-lg text-sm font-medium transition-all shadow-sm w-full md:w-auto"
                  >
                    <LinkIcon className="w-4 h-4" /> Link Google Account
                  </button>
                )}

                {/* Google Business Profile — always visible */}
                <div className="bg-card border border-border-custom rounded-xl w-full overflow-hidden">
                  {editingBusinessId === acc.id ? (
                    <div className="flex items-center gap-2 p-3">
                      <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <input
                        type="url"
                        value={editBusinessUrl}
                        onChange={e => setEditBusinessUrl(e.target.value)}
                        placeholder="https://business.google.com/..."
                        className="flex-grow text-sm bg-transparent border-b border-orange-400 outline-none py-0.5 text-foreground placeholder:opacity-40"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveBusinessUrl(acc.id);
                          if (e.key === 'Escape') setEditingBusinessId(null);
                        }}
                      />
                      <button onClick={() => saveBusinessUrl(acc.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingBusinessId(null)} className="p-1 text-muted hover:bg-accent-custom rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        {acc.googleBusinessUrl ? (
                          <a
                            href={acc.googleBusinessUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 truncate"
                          >
                            Business Profile
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-muted">Business Profile: <span className="text-xs bg-muted/20 px-1.5 py-0.5 rounded-full">Not linked</span></span>
                        )}
                      </div>
                      <button
                        onClick={() => { setEditingBusinessId(acc.id); setEditBusinessUrl(acc.googleBusinessUrl || ''); }}
                        className="px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 rounded-lg transition-colors flex-shrink-0"
                      >
                        {acc.googleBusinessUrl ? 'Edit' : 'Add Link'}
                      </button>
                    </div>
                  )}
                </div>

                
                <button 
                  onClick={() => deleteAccount(acc.id)}
                  className="p-2 text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors md:self-end mt-2"
                  title="Delete Account"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
        {accounts.length === 0 && (
          <div className="text-center p-12 border-2 border-dashed border-border-custom rounded-2xl bg-card">
            <p className="text-muted mb-4">No accounts created yet.</p>
            <button 
              onClick={createAccount}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create First Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
