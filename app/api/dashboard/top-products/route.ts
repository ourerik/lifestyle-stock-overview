import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { SalesAggregator } from '@/lib/services/sales-aggregator';
import { getDateRange, getCustomDateRange } from '@/lib/utils/date';
import type { CompanyId } from '@/config/companies';
import type { PeriodType, ComparisonType, Env, CustomDateRange } from '@/types';
import type { TopProductsData } from '@/types/top-products';

const VALID_COMPANIES: CompanyId[] = ['all', 'varg', 'sneaky-steve'];
const VALID_PERIODS: PeriodType[] = [
  'last-7-days', 'today', 'yesterday', 'week', 'last-week',
  'month', 'last-month', 'year', 'last-12-months', 'last-year', 'custom',
];

// Simple in-memory cache
const cache = new Map<string, { data: TopProductsData[]; cachedAt: Date }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

function getCacheKey(company: string, period: string, comparison: string): string {
  return `top-products-${company}-${period}-${comparison}`;
}

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const company = searchParams.get('company') as CompanyId;
  const period = searchParams.get('period') as PeriodType;
  const comparison = (searchParams.get('comparison') as ComparisonType) || 'period';
  const force = searchParams.get('force') === 'true';
  const customFrom = searchParams.get('from');
  const customTo = searchParams.get('to');

  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json({ error: 'Invalid company parameter' }, { status: 400 });
  }

  if (!period || !VALID_PERIODS.includes(period)) {
    return NextResponse.json({ error: 'Invalid period parameter' }, { status: 400 });
  }

  if (period === 'custom' && (!customFrom || !customTo)) {
    return NextResponse.json({ error: 'Custom period requires from and to parameters' }, { status: 400 });
  }

  const cacheKey = getCacheKey(company, period, comparison);

  // Check cache
  if (!force) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt.getTime() < CACHE_TTL_MS) {
      return NextResponse.json({
        data: cached.data,
        cachedAt: cached.cachedAt.toISOString(),
        fromCache: true,
      });
    }
  }

  try {
    const customDateRange: CustomDateRange | undefined =
      period === 'custom' && customFrom && customTo
        ? { from: customFrom, to: customTo }
        : undefined;

    const { current } = period === 'custom' && customDateRange
      ? getCustomDateRange(customDateRange, comparison)
      : getDateRange(period, comparison);

    const env: Env = process.env as unknown as Env;
    const aggregator = new SalesAggregator(env);
    const data = await aggregator.fetchTopProducts(company, current.start, current.end);

    const cachedAt = new Date();
    cache.set(cacheKey, { data, cachedAt });

    return NextResponse.json({
      data,
      cachedAt: cachedAt.toISOString(),
      fromCache: false,
    });
  } catch (error) {
    console.error('Failed to fetch top products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top products data' },
      { status: 500 }
    );
  }
}
