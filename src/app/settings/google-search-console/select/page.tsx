'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, ArrowRight, Globe, ShieldCheck, CheckSquare, Square } from 'lucide-react';

import { Suspense } from 'react';

function GoogleSearchConsoleSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainAccountId = searchParams.get('mainAccountId');

  const [sites, setSites] = useState<any[]>([]);
  const [selectedSites, setSelectedSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mainAccountId) {
      setError({ message: 'Missing mainAccountId' });
      setLoading(false);
      return;
    }

    fetch(`/api/search-console/sites?mainAccountId=${mainAccountId}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw data;
        return data;
      })
      .then(data => {
        setSites(data.sites || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [mainAccountId]);

  const toggleSite = (site: any) => {
    if (selectedSites.find(s => s.siteUrl === site.siteUrl)) {
      setSelectedSites(selectedSites.filter(s => s.siteUrl !== site.siteUrl));
    } else {
      setSelectedSites([...selectedSites, site]);
    }
  };

  const saveSelection = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/search-console/sites/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainAccountId, sites: selectedSites })
      });

      if (res.ok) {
        router.push('/settings?success=search_console_linked');
      } else {
        throw new Error('Failed to save selection');
      }
    } catch (err) {
      alert('Error saving selection. Please try again.');
      setSaving(false);
    }
  };

  const getPermissionBadge = (level: string) => {
    const colors: Record<string, string> = {
      siteOwner: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      siteFullUser: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      siteRestrictedUser: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    };
    const labels: Record<string, string> = {
      siteOwner: 'Owner',
      siteFullUser: 'Full User',
      siteRestrictedUser: 'Restricted',
    };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${colors[level] || 'bg-muted text-muted'}`}>
        {labels[level] || level}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
        <p className="text-muted font-medium animate-pulse">Fetching your Search Console sites...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 p-8 rounded-2xl">
          <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
            <AlertCircle className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Configuration Error</h1>
          </div>
          <p className="mb-4">{error.error || error.message || 'An unexpected error occurred.'}</p>
          <p className="text-sm opacity-70 mb-6">{error.details || ''}</p>
          <button
            onClick={() => router.push('/settings')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
          >
            Return to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-2xl mb-4">
          <Globe className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Select Search Console Sites</h1>
        <p className="text-muted mt-2 text-lg">
          Choose the domains you want to track in your dashboard.
        </p>
      </div>

      <div className="grid gap-4 mb-8">
        {sites.map(site => {
          const isSelected = !!selectedSites.find(s => s.siteUrl === site.siteUrl);
          return (
            <button
              key={site.siteUrl}
              onClick={() => toggleSite(site)}
              disabled={saving}
              className={`group w-full text-left p-6 bg-card border-2 rounded-2xl transition-all duration-200 hover:shadow-md ${
                isSelected
                  ? 'border-violet-600 shadow-violet-600/5 shadow-lg'
                  : 'border-border-custom hover:border-violet-200 dark:hover:border-violet-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300'
                      : 'bg-accent-custom text-muted'
                  }`}>
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-foreground text-base break-all">{site.siteUrl}</h3>
                    <div className="mt-1">
                      {site.permissionLevel && getPermissionBadge(site.permissionLevel)}
                    </div>
                  </div>
                </div>
                <div className={`flex-shrink-0 ml-4 ${isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-muted opacity-40'} transition-all`}>
                  {isSelected ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                </div>
              </div>
            </button>
          );
        })}

        {sites.length === 0 && (
          <div className="text-center p-12 border-2 border-dashed border-border-custom rounded-3xl bg-card">
            <Globe className="w-12 h-12 text-muted mx-auto mb-4 opacity-40" />
            <p className="text-muted font-medium">No Search Console sites were found for this account.</p>
            <p className="text-muted text-sm mt-1 opacity-70">Make sure you have verified sites in Google Search Console.</p>
            <button
              onClick={() => router.push('/settings')}
              className="mt-4 text-violet-600 dark:text-violet-400 font-bold hover:underline"
            >
              Return to Settings
            </button>
          </div>
        )}
      </div>

      {sites.length > 0 && (
        <div className="flex justify-end gap-4 border-t border-border-custom pt-6">
          <button
            onClick={() => router.push('/settings')}
            className="px-6 py-3 font-bold text-muted hover:text-foreground transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={saveSelection}
            disabled={saving || selectedSites.length === 0}
            className="flex items-center gap-2 px-8 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-sm shadow-violet-600/20"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                Save Selection ({selectedSites.length})
                <CheckCircle2 className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function GoogleSearchConsoleSelect() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    }>
      <GoogleSearchConsoleSelectContent />
    </Suspense>
  );
}
