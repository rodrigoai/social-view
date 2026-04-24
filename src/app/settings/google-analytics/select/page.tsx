'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/Card';
import { CheckCircle2, AlertCircle, ArrowRight, Activity, ShieldCheck, CheckSquare, Square } from 'lucide-react';

export default function GoogleAnalyticsSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainAccountId = searchParams.get('mainAccountId');
  
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mainAccountId) {
      setError({ message: 'Missing mainAccountId' });
      setLoading(false);
      return;
    }

    fetch(`/api/analytics/properties?mainAccountId=${mainAccountId}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw data;
        return data;
      })
      .then(data => {
        setProperties(data.properties || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch properties:', err);
        setError(err);
        setLoading(false);
      });
  }, [mainAccountId]);

  const toggleProperty = (property: any) => {
    if (selectedProperties.find(p => p.id === property.id)) {
      setSelectedProperties(selectedProperties.filter(p => p.id !== property.id));
    } else {
      setSelectedProperties([...selectedProperties, property]);
    }
  };

  const saveSelection = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/analytics/properties/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainAccountId, properties: selectedProperties })
      });
      
      if (res.ok) {
        router.push('/settings?success=google_analytics_linked');
      } else {
        throw new Error('Failed to save selection');
      }
    } catch (err) {
      alert('Error saving selection. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 font-medium animate-pulse">Fetching your Google Analytics properties...</p>
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
          
          <div>
            <p className="mb-4">{error.message || 'An unexpected error occurred while fetching properties.'}</p>
            <p className="mb-4 text-sm opacity-80">{error.details || ''}</p>
            <button 
              onClick={() => router.push('/settings')}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold"
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
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl mb-4">
          <Activity className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Select Google Analytics Properties</h1>
        <p className="text-gray-500 mt-2 text-lg">Select the properties you want to track for this account.</p>
      </div>

      <div className="grid gap-4 mb-8">
        {properties.map((property) => {
          const isSelected = !!selectedProperties.find(p => p.id === property.id);
          return (
            <button
              key={property.id}
              onClick={() => toggleProperty(property)}
              disabled={saving}
              className={`group relative text-left p-6 bg-card border-2 rounded-2xl transition-all duration-200 hover:shadow-md ${
                isSelected 
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/10' 
                  : 'border-border-custom hover:border-emerald-200 dark:hover:border-emerald-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-800 dark:text-emerald-300' : 'bg-accent-custom text-muted group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{property.name}</h3>
                    <p className="text-muted font-mono text-sm">ID: {property.id}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 ${isSelected ? 'text-emerald-600' : 'text-muted opacity-50 group-hover:opacity-100 group-hover:text-emerald-500'} transition-all`}>
                  {isSelected ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                </div>
              </div>
            </button>
          );
        })}

        {properties.length === 0 && (
          <div className="text-center p-12 border-2 border-dashed border-border-custom rounded-3xl bg-card">
            <p className="text-muted">No Google Analytics properties were found for this login.</p>
            <button 
              onClick={() => router.push('/settings')}
              className="mt-4 text-emerald-600 font-bold hover:underline"
            >
              Try a different login
            </button>
          </div>
        )}
      </div>

      {properties.length > 0 && (
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
            disabled={saving || selectedProperties.length === 0}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-sm shadow-emerald-600/20"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                Save Selection ({selectedProperties.length})
                <CheckCircle2 className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
