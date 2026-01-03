import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { SalesAggregator } from '@/lib/services/sales-aggregator';
import { getFromCache, setInCache } from '@/lib/cache/dashboard-cache';
import type { CompanyId } from '@/config/companies';
import type { PeriodType, ComparisonType, Env } from '@/types';

const VALID_COMPANIES: CompanyId[] = ['all', 'varg', 'sneaky-steve'];
const VALID_PERIODS: PeriodType[] = ['today', 'week', 'month', 'last-week', 'last-month'];
const VALID_COMPARISONS: ComparisonType[] = ['period', 'year'];

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const company = searchParams.get('company') as CompanyId;
  const period = searchParams.get('period') as PeriodType;
  const comparison = (searchParams.get('comparison') as ComparisonType) || 'period';
  const force = searchParams.get('force') === 'true';

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter' },
      { status: 400 }
    );
  }

  if (!period || !VALID_PERIODS.includes(period)) {
    return NextResponse.json(
      { error: 'Invalid period parameter' },
      { status: 400 }
    );
  }

  if (!VALID_COMPARISONS.includes(comparison)) {
    return NextResponse.json(
      { error: 'Invalid comparison parameter' },
      { status: 400 }
    );
  }

  // Check cache (unless force refresh)
  if (!force) {
    const cached = getFromCache(company, period, comparison);
    if (cached) {
      return NextResponse.json({
        data: cached.data,
        cachedAt: cached.cachedAt.toISOString(),
        fromCache: true,
      });
    }
  }

  // Fetch fresh data
  try {
    const env: Env = process.env as unknown as Env;
    const aggregator = new SalesAggregator(env);
    const data = await aggregator.fetchDashboardData(company, period, comparison);

    // Store in cache
    setInCache(company, period, comparison, data);

    return NextResponse.json({
      data,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    });
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
