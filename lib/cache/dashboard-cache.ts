import type { DashboardData } from '@/types';

interface CacheEntry {
  data: DashboardData;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

const cache = new Map<string, CacheEntry>();

function getCacheKey(company: string, period: string, comparison: string): string {
  return `${company}-${period}-${comparison}`;
}

export function getFromCache(company: string, period: string, comparison: string): { data: DashboardData; cachedAt: Date } | null {
  const key = getCacheKey(company, period, comparison);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return {
    data: entry.data,
    cachedAt: new Date(entry.timestamp),
  };
}

export function setInCache(company: string, period: string, comparison: string, data: DashboardData): void {
  const key = getCacheKey(company, period, comparison);
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateCache(company?: string, period?: string): void {
  if (!company && !period) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    const [cachedCompany, cachedPeriod] = key.split('-');
    if ((!company || cachedCompany === company) && (!period || cachedPeriod === period)) {
      cache.delete(key);
    }
  }
}

export function getCacheAge(company: string, period: string, comparison: string): number | null {
  const key = getCacheKey(company, period, comparison);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  return Date.now() - entry.timestamp;
}
