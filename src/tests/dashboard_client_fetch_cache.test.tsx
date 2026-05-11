/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { GoogleDashboardView } from '@/components/dashboard/GoogleDashboardView';
import { MetaDashboardView } from '@/components/dashboard/MetaDashboardView';
import { getDashboardCacheKey, writeDashboardCache } from '@/lib/dashboardClientCache';

describe('dashboard views client cache', () => {
  const filters = {
    period: '7d',
    campaign: 'all',
    startDate: '',
    endDate: ''
  };

  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn();
  });

  it('uses cached Google dashboard data instead of fetching again', async () => {
    const cacheKey = getDashboardCacheKey('google', 'acc1', filters);
    writeDashboardCache(cacheKey, {
      data: { summary: { totalCost: 0, totalConversions: 0 }, campaigns: [] },
      gaData: { properties: [] },
      scData: { sites: [] },
      pageSpeedData: { configured: false, scores: [] },
      adsError: null,
      gaError: null,
      scError: null,
      pageSpeedError: null
    });

    render(
      <GoogleDashboardView
        selectedAccountId="acc1"
        selectedAccount={{ id: 'acc1', name: 'Account' }}
        onOpenKpi={() => {}}
        filters={filters}
        onFilterChange={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText('Google Ads')).toBeInTheDocument());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses cached Meta dashboard data instead of fetching again', async () => {
    const cacheKey = getDashboardCacheKey('meta', 'acc1', filters);
    writeDashboardCache(cacheKey, {
      data: { summary: { totalCost: 0, totalConversions: 0, totalImpressions: 0 }, campaigns: [] },
      fbData: { pages: [] },
      igData: { accounts: [] },
      adsError: null,
      fbError: null,
      igError: null
    });

    render(
      <MetaDashboardView
        selectedAccountId="acc1"
        onOpenKpi={() => {}}
        filters={filters}
        onFilterChange={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText('Meta Ads')).toBeInTheDocument());
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
