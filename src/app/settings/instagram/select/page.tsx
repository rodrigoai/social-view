'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/Card';
import { AlertCircle, ArrowRight, Building2, ShieldCheck } from 'lucide-react';

export default function InstagramSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainAccountId = searchParams.get('mainAccountId');
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    if (!mainAccountId) {
      setError({ message: 'Missing mainAccountId' });
      setLoading(false);
      return;
    }

    fetch(`/api/meta/instagram/accounts?mainAccountId=${mainAccountId}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw data;
        return data;
      })
      .then(data => {
        setAccounts(data.accounts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch Instagram accounts:', err);
        setError(err);
        setLoading(false);
      });
  }, [mainAccountId]);

  const selectAccount = async (account: any) => {
    setSelecting(account.id);
    try {
      const res = await fetch('/api/meta/instagram/accounts/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainAccountId, accountId: account.id, accountName: account.name, facebookPageId: account.facebookPageId })
      });
      
      if (res.ok) {
        router.push('/settings?success=meta_linked');
      } else {
        throw new Error('Failed to save selection');
      }
    } catch (err) {
      alert('Error saving selection. Please try again.');
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 font-medium animate-pulse">Fetching your Instagram Accounts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 p-8 rounded-2xl">
          <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
            <AlertCircle className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Error Occurred</h1>
          </div>
          <div>
            <p className="mb-4">{error.message || 'An unexpected error occurred while fetching accounts.'}</p>
            <button 
              onClick={() => router.push('/settings')}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
            >
              Return to Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-2xl mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Select Instagram Account</h1>
        <p className="text-muted mt-2 text-lg">We found {accounts.length} accounts accessible with your login.</p>
      </div>

      <div className="grid gap-4">
        {accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => selectAccount(acc)}
            disabled={!!selecting}
            className={`group relative text-left p-6 bg-card border-2 rounded-2xl transition-all duration-200 hover:shadow-md ${
              selecting === acc.id 
                ? 'border-pink-600 bg-pink-50 dark:bg-pink-900/20' 
                : 'border-border-custom hover:border-pink-200 dark:hover:border-pink-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent-custom text-muted group-hover:bg-pink-100 group-hover:text-pink-600 dark:group-hover:bg-pink-900/30 rounded-xl flex items-center justify-center transition-colors">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{acc.name}</h3>
                  <p className="text-muted font-mono text-sm">ID: {acc.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Select</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
            {selecting === acc.id && (
              <div className="absolute inset-0 bg-card/60 rounded-2xl flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-600"></div>
              </div>
            )}
          </button>
        ))}

        {accounts.length === 0 && (
          <div className="text-center p-12 border-2 border-dashed border-border-custom rounded-3xl bg-card">
            <p className="text-muted">No Instagram accounts were found for this login.</p>
            <button 
              onClick={() => router.push('/settings')}
              className="mt-4 text-pink-600 dark:text-pink-400 font-bold hover:underline"
            >
              Try a different login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
