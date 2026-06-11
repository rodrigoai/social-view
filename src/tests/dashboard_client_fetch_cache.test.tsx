/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { GoogleDashboardView } from '@/components/dashboard/GoogleDashboardView';
import { MetaDashboardView } from '@/components/dashboard/MetaDashboardView';
import {
  getDashboardCacheKey,
  getPageSpeedCacheKey,
  writeDashboardCache,
  writePageSpeedCache
} from '@/lib/dashboardClientCache';

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
      adsError: null,
      gaError: null,
      scError: null
    });
    writePageSpeedCache(getPageSpeedCacheKey('acc1'), {
      pageSpeedData: { configured: false, scores: [] }
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

  it('reuses the weekly PageSpeed cache while refreshing expired dashboard KPIs', async () => {
    writePageSpeedCache(getPageSpeedCacheKey('acc1'), {
      pageSpeedData: {
        configured: true,
        finalUrl: 'https://example.com',
        strategies: {
          mobile: { scores: [] },
          desktop: { scores: [] }
        }
      }
    });

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/api/ads/campaigns')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ summary: { totalCost: 125, totalConversions: 5 }, campaigns: [] })
        });
      }

      if (url.startsWith('/api/analytics/dashboard')) {
        return Promise.resolve({ ok: true, json: async () => ({ properties: [] }) });
      }

      return Promise.resolve({ ok: true, json: async () => ({ sites: [] }) });
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

    await waitFor(() => expect(screen.getByText('R$ 125,00')).toBeInTheDocument());
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/pagespeed/dashboard'));
  });

  it('renders the main Google KPIs while PageSpeed Insights is still loading', async () => {
    let resolvePageSpeed: (response: any) => void = () => {};
    const pageSpeedResponse = new Promise((resolve) => {
      resolvePageSpeed = resolve;
    });

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/api/pagespeed/dashboard')) {
        return pageSpeedResponse;
      }

      if (url.startsWith('/api/ads/campaigns')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ summary: { totalCost: 125, totalConversions: 5 }, campaigns: [] })
        });
      }

      if (url.startsWith('/api/analytics/dashboard')) {
        return Promise.resolve({ ok: true, json: async () => ({ properties: [] }) });
      }

      return Promise.resolve({ ok: true, json: async () => ({ sites: [] }) });
    });

    const { rerender } = render(
      <GoogleDashboardView
        selectedAccountId="acc1"
        selectedAccount={{ id: 'acc1', name: 'Account' }}
        onOpenKpi={() => {}}
        filters={filters}
        onFilterChange={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText('Google Ads')).toBeInTheDocument());
    expect(screen.getByText('R$ 125,00')).toBeInTheDocument();
    expect(screen.getByTestId('pagespeed-skeleton')).toBeInTheDocument();

    rerender(
      <GoogleDashboardView
        selectedAccountId="acc1"
        selectedAccount={{ id: 'acc1', name: 'Account' }}
        onOpenKpi={() => {}}
        filters={{ ...filters, period: '30d' }}
        onFilterChange={() => {}}
      />
    );

    await waitFor(() => {
      const pageSpeedCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
        url.startsWith('/api/pagespeed/dashboard')
      );
      expect(pageSpeedCalls).toHaveLength(1);
    });

    resolvePageSpeed({
      ok: true,
      json: async () => ({ configured: false, scores: [] })
    });

    await waitFor(() => expect(screen.getByText('Main website not configured')).toBeInTheDocument());
  });

  it('shows dashboard skeletons while Google and Meta API calls are pending', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { unmount } = render(
      <GoogleDashboardView
        selectedAccountId="acc1"
        selectedAccount={{ id: 'acc1', name: 'Account' }}
        onOpenKpi={() => {}}
        filters={filters}
        onFilterChange={() => {}}
      />
    );

    expect(screen.getByTestId('google-dashboard-skeleton')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();

    unmount();

    render(
      <MetaDashboardView
        selectedAccountId="acc1"
        onOpenKpi={() => {}}
        filters={filters}
        onFilterChange={() => {}}
      />
    );

    expect(screen.getByTestId('meta-dashboard-skeleton')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
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
