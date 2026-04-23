'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/Card';
import { CheckCircle2, AlertCircle, ArrowRight, Building2, ShieldCheck } from 'lucide-react';

export default function GoogleAdsSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainAccountId = searchParams.get('mainAccountId');
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    if (!mainAccountId) {
      setError({ message: 'Missing mainAccountId' });
      setLoading(false);
      return;
    }

    fetch(`/api/ads/accounts?mainAccountId=${mainAccountId}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw data;
        return data;
      })
      .then(data => {
        setCustomers(data.customers || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch accounts:', err);
        setError(err);
        setLoading(false);
      });
  }, [mainAccountId]);

  const selectAccount = async (customerId: string) => {
    setSelecting(customerId);
    try {
      const res = await fetch('/api/ads/accounts/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainAccountId, customerId })
      });
      
      if (res.ok) {
        router.push('/settings?success=google_linked');
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
        <p className="text-gray-500 font-medium animate-pulse">Fetching your Google Ads accounts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <div className="bg-red-50 border border-red-100 text-red-700 p-8 rounded-2xl">
          <div className="flex items-center gap-3 mb-4 text-red-600">
            <AlertCircle className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Configuration Required</h1>
          </div>
          
          {error.error === 'DEVELOPER_TOKEN_MISSING' ? (
            <div className="space-y-4">
              <p className="text-lg">To fetch your accounts, you need a **Google Ads Developer Token**.</p>
              <div className="bg-white p-4 rounded-xl border border-red-200 font-mono text-sm">
                GOOGLE_ADS_DEVELOPER_TOKEN="your_token_here"
              </div>
              <p className="text-sm opacity-80 italic">Add this to your `.env` file and restart the server.</p>
              <button 
                onClick={() => router.push('/settings')}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                Back to Settings
              </button>
            </div>
          ) : (
            <div>
              <p className="mb-4">{error.message || 'An unexpected error occurred while fetching accounts.'}</p>
              <button 
                onClick={() => router.push('/settings')}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold"
              >
                Return to Settings
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Select Google Ads Account</h1>
        <p className="text-gray-500 mt-2 text-lg">We found {customers.length} accounts accessible with your login.</p>
      </div>

      <div className="grid gap-4">
        {customers.map((customer) => (
          <button
            key={customer.id}
            onClick={() => selectAccount(customer.id)}
            disabled={!!selecting}
            className={`group relative text-left p-6 bg-white border-2 rounded-2xl transition-all duration-200 hover:shadow-md ${
              selecting === customer.id 
                ? 'border-blue-600 bg-blue-50' 
                : 'border-gray-100 hover:border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 rounded-xl flex items-center justify-center transition-colors">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{customer.name}</h3>
                  <p className="text-gray-500 font-mono text-sm">ID: {customer.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Select</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
            {selecting === customer.id && (
              <div className="absolute inset-0 bg-white/60 rounded-2xl flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            )}
          </button>
        ))}

        {customers.length === 0 && (
          <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50">
            <p className="text-gray-500">No Google Ads accounts were found for this login.</p>
            <button 
              onClick={() => router.push('/settings')}
              className="mt-4 text-blue-600 font-bold hover:underline"
            >
              Try a different login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
