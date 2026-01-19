import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { SalesAggregator } from '@/lib/services/sales-aggregator';
import { getDateRange } from '@/lib/utils/date';
import type { CompanyId } from '@/config/companies';
import type { Env } from '@/types';

const VALID_COMPANIES: CompanyId[] = ['all', 'varg', 'sneaky-steve'];

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const company = searchParams.get('company') as CompanyId;

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter' },
      { status: 400 }
    );
  }

  try {
    // Get the last 7 days date range
    const { current } = getDateRange('last-7-days');

    const env: Env = process.env as unknown as Env;
    const aggregator = new SalesAggregator(env);
    const data = await aggregator.fetchTimeSlotData(company, current.start, current.end);

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Failed to fetch time-slot data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time-slot data' },
      { status: 500 }
    );
  }
}
