import React, { useState } from 'react';
import { Calendar, Filter, RefreshCw } from 'lucide-react';

interface FilterPanelProps {
  onFilterChange: (filters: { period: string; campaign: string; startDate?: string; endDate?: string }) => void;
  campaigns?: string[];
  currentPeriod?: string;
  currentCampaign?: string;
  currentStartDate?: string;
  currentEndDate?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function FilterPanel({ 
  onFilterChange, 
  campaigns = [], 
  currentPeriod = '7d', 
  currentCampaign = 'all',
  currentStartDate = '',
  currentEndDate = '',
  onRefresh,
  refreshing = false
}: FilterPanelProps) {
  const [period, setPeriod] = useState(currentPeriod);
  const [campaign, setCampaign] = useState(currentCampaign);
  const [startDate, setStartDate] = useState(currentStartDate);
  const [endDate, setEndDate] = useState(currentEndDate);

  const handleApply = () => {
    if (period === 'custom') {
      if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 90) {
        alert('The maximum range allowed is 3 months (90 days).');
        return;
      }

      if (start > end) {
        alert('Start date cannot be after end date.');
        return;
      }
    }
    onFilterChange({ period, campaign, startDate, endDate });
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border-custom p-4 mb-6 flex flex-col gap-4 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center">
          <div className="relative w-full sm:w-48">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-muted" />
            </div>
            <select 
              className="pl-10 pr-8 py-2 bg-accent-custom border border-border-custom text-foreground text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full appearance-none transition-colors"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 w-full sm:w-auto animate-in slide-in-from-left-2 duration-300">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 bg-accent-custom border border-border-custom text-foreground text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block transition-colors"
              />
              <span className="text-muted">to</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 bg-accent-custom border border-border-custom text-foreground text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block transition-colors"
              />
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-muted" />
            </div>
            <select 
              className="pl-10 pr-8 py-2 bg-accent-custom border border-border-custom text-foreground text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full appearance-none transition-colors"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            >
              <option value="all">All Campaigns</option>
              {campaigns.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex w-full sm:w-auto gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="w-full sm:w-auto px-4 py-2 bg-accent-custom hover:bg-border-custom disabled:opacity-60 text-foreground text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          <button
            onClick={handleApply}
            className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
