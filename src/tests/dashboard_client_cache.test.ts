/**
 * @jest-environment jsdom
 */
import {
  clearDashboardCache,
  getDashboardCacheKey,
  getPageSpeedCacheKey,
  readDashboardCache,
  writeDashboardCache,
  writePageSpeedCache
} from '@/lib/dashboardClientCache';

describe('dashboard client cache', () => {
  const filters = {
    period: '7d',
    campaign: 'all',
    startDate: '',
    endDate: ''
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses separate cache keys per dashboard scope', () => {
    const googleKey = getDashboardCacheKey('google', 'acc1', filters);
    const metaKey = getDashboardCacheKey('meta', 'acc1', filters);

    expect(googleKey).not.toBe(metaKey);
    expect(googleKey).toContain('google');
    expect(metaKey).toContain('meta');
  });

  it('reads a fresh cache entry for the same account and filters', () => {
    const key = getDashboardCacheKey('google', 'acc1', filters);
    const payload = { data: { campaigns: [] } };

    writeDashboardCache(key, payload, 1_000);

    expect(readDashboardCache(key, 1_000 + 60_000)).toEqual(payload);
  });

  it('expires entries after 12 hours', () => {
    const key = getDashboardCacheKey('google', 'acc1', filters);

    writeDashboardCache(key, { data: 'cached' }, 1_000);

    expect(readDashboardCache(key, 1_000 + (12 * 60 * 60 * 1000) + 1)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('keeps PageSpeed entries for one week', () => {
    const key = getPageSpeedCacheKey('acc1');
    const payload = { pageSpeedData: { configured: true } };

    writePageSpeedCache(key, payload, 1_000);

    expect(readDashboardCache(key, 1_000 + (12 * 60 * 60 * 1000) + 1)).toEqual(payload);
    expect(readDashboardCache(key, 1_000 + (7 * 24 * 60 * 60 * 1000) + 1)).toBeNull();
  });

  it('uses one PageSpeed cache key per account regardless of dashboard filters', () => {
    expect(getPageSpeedCacheKey('acc1')).toBe(getPageSpeedCacheKey('acc1'));
    expect(getPageSpeedCacheKey('acc1')).not.toBe(getPageSpeedCacheKey('acc2'));
  });

  it('clears only the active dashboard cache key', () => {
    const googleKey = getDashboardCacheKey('google', 'acc1', filters);
    const metaKey = getDashboardCacheKey('meta', 'acc1', filters);

    writeDashboardCache(googleKey, { source: 'google' }, 1_000);
    writeDashboardCache(metaKey, { source: 'meta' }, 1_000);
    clearDashboardCache(googleKey);

    expect(readDashboardCache(googleKey, 2_000)).toBeNull();
    expect(readDashboardCache(metaKey, 2_000)).toEqual({ source: 'meta' });
  });

  it('uses separate cache keys when filters change', () => {
    const firstKey = getDashboardCacheKey('google', 'acc1', filters);
    const secondKey = getDashboardCacheKey('google', 'acc1', { ...filters, period: '30d' });

    expect(firstKey).not.toBe(secondKey);
  });
});
