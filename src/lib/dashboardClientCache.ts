const CACHE_PREFIX = 'socialview:dashboard-cache:';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type DashboardCacheEntry<T> = {
  expiresAt: number;
  payload: T;
};

export type DashboardCacheScope = 'google' | 'meta';

export function getDashboardCacheKey(scope: DashboardCacheScope, selectedAccountId: string, filters: any) {
  const normalizedFilters = {
    period: filters?.period || '',
    campaign: filters?.campaign || '',
    startDate: filters?.startDate || '',
    endDate: filters?.endDate || ''
  };

  return `${CACHE_PREFIX}${scope}:${selectedAccountId}:${JSON.stringify(normalizedFilters)}`;
}

export function getPageSpeedCacheKey(selectedAccountId: string) {
  return `${CACHE_PREFIX}pagespeed:${selectedAccountId}`;
}

export function readDashboardCache<T>(key: string, now = Date.now()): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as DashboardCacheEntry<T>;
    if (!entry || typeof entry.expiresAt !== 'number' || entry.expiresAt <= now) {
      window.localStorage.removeItem(key);
      return null;
    }

    return entry.payload;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeCache<T>(key: string, payload: T, ttl: number, now: number) {
  if (typeof window === 'undefined') return;

  const entry: DashboardCacheEntry<T> = {
    expiresAt: now + ttl,
    payload
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage can be unavailable or full; fetching fresh data is still valid.
  }
}

export function writeDashboardCache<T>(key: string, payload: T, now = Date.now()) {
  writeCache(key, payload, TWELVE_HOURS_MS, now);
}

export function writePageSpeedCache<T>(key: string, payload: T, now = Date.now()) {
  writeCache(key, payload, ONE_WEEK_MS, now);
}

export function clearDashboardCache(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}
