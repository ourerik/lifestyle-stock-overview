import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { ElasticsearchConnector } from '@/lib/connectors/elasticsearch'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type {
  ProductPerformanceDetail,
  VariantPerformance,
  PeriodMetrics,
  RollingPeriod,
} from '@/types/performance'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

// Period key to index mapping for rolling periods (0 = most recent)
const PERIOD_KEY_TO_INDEX: Record<string, number> = {
  '0-3m': 0,
  '3-6m': 1,
  '6-9m': 2,
  '9-12m': 3,
}

// Format month range label (e.g., "okt-dec 24")
function formatPeriodLabel(startDate: Date, endDate: Date): string {
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const startMonth = months[startDate.getMonth()]
  const endMonth = months[endDate.getMonth()]
  const year = endDate.getFullYear().toString().slice(-2)
  return `${startMonth}-${endMonth} ${year}`
}

// Generate rolling period definitions (always 12 months with 14-day offset)
function generatePeriodDefinitions(): {
  definitions: RollingPeriod[]
  keyToIndex: Record<string, number>
} {
  const now = new Date()
  // Apply 14-day offset
  now.setDate(now.getDate() - 14)

  const definitions: RollingPeriod[] = []

  for (let i = 0; i < 4; i++) {
    const endDate = new Date(now)
    endDate.setMonth(endDate.getMonth() - (i * 3))

    const startDate = new Date(endDate)
    startDate.setMonth(startDate.getMonth() - 3)

    definitions.push({
      label: formatPeriodLabel(startDate, endDate),
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      periodIndex: i,
    })
  }

  return { definitions, keyToIndex: PERIOD_KEY_TO_INDEX }
}

// Simple in-memory cache (includes previousVariants)
interface CachedDetailData {
  data: ProductPerformanceDetail
  previousVariants: VariantPerformance[] | null
  cachedAt: Date
}
const detailCache: Map<string, CachedDetailData> = new Map()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function getCacheKey(company: string, productNumber: string, periodMonths: number): string {
  return `${company}:${productNumber}:${periodMonths}m`
}

function getFromCache(key: string): CachedDetailData | null {
  const cached = detailCache.get(key)
  if (!cached) return null

  const age = Date.now() - cached.cachedAt.getTime()
  if (age > CACHE_TTL_MS) {
    detailCache.delete(key)
    return null
  }

  return cached
}

// Helper type for raw ES variant data
type RawVariant = {
  variantNumber: string
  variantName: string
  periods: Array<{
    periodKey: string
    salesQuantity: number
    returnQuantity: number
    turnover: number
    costs: number
    avgDiscountPercent: number
    medianCustomerAge: number | null
  }>
}

// Transform raw variant data to typed structure
function transformVariants(
  rawVariants: RawVariant[],
  periodDefinitions: RollingPeriod[],
  periodKeyToIndex: Record<string, number>,
  periodsToIncludeInTotals: Set<number>
): VariantPerformance[] {
  return rawVariants.map(raw => {
    let totalSalesQuantity = 0
    let totalReturnQuantity = 0
    let totalTurnover = 0
    let totalCosts = 0
    let totalDiscountSum = 0
    let discountCount = 0
    let ageSum = 0
    let ageCount = 0

    const periods: PeriodMetrics[] = raw.periods.map(rawPeriod => {
      const periodIndex = periodKeyToIndex[rawPeriod.periodKey] ?? 0
      const periodDef = periodDefinitions.find(p => p.periodIndex === periodIndex) || {
        label: rawPeriod.periodKey,
        startDate: '',
        endDate: '',
        periodIndex,
      }

      const returnRate = rawPeriod.salesQuantity > 0
        ? Math.round((rawPeriod.returnQuantity / rawPeriod.salesQuantity) * 1000) / 10
        : 0

      const tb = rawPeriod.turnover - rawPeriod.costs
      const tbPercent = rawPeriod.turnover > 0
        ? Math.round((tb / rawPeriod.turnover) * 1000) / 10
        : 0

      // Only accumulate totals for periods within the selected time range
      if (periodsToIncludeInTotals.has(periodIndex)) {
        totalSalesQuantity += rawPeriod.salesQuantity
        totalReturnQuantity += rawPeriod.returnQuantity
        totalTurnover += rawPeriod.turnover
        totalCosts += rawPeriod.costs

        if (rawPeriod.avgDiscountPercent > 0) {
          totalDiscountSum += rawPeriod.avgDiscountPercent * rawPeriod.salesQuantity
          discountCount += rawPeriod.salesQuantity
        }

        if (rawPeriod.medianCustomerAge && rawPeriod.medianCustomerAge > 0) {
          ageSum += rawPeriod.medianCustomerAge * rawPeriod.salesQuantity
          ageCount += rawPeriod.salesQuantity
        }
      }

      return {
        period: periodDef,
        salesQuantity: rawPeriod.salesQuantity,
        returnQuantity: rawPeriod.returnQuantity,
        returnRate,
        medianCustomerAge: rawPeriod.medianCustomerAge && rawPeriod.medianCustomerAge > 0
          ? Math.round(rawPeriod.medianCustomerAge)
          : null,
        avgDiscountPercent: Math.round((rawPeriod.avgDiscountPercent || 0) * 10) / 10,
        turnover: Math.round(rawPeriod.turnover),
        costs: Math.round(rawPeriod.costs),
        tb: Math.round(tb),
        tbPercent,
      }
    })

    // Calculate totals
    const totalReturnRate = totalSalesQuantity > 0
      ? Math.round((totalReturnQuantity / totalSalesQuantity) * 1000) / 10
      : 0
    const totalTb = totalTurnover - totalCosts
    const totalTbPercent = totalTurnover > 0
      ? Math.round((totalTb / totalTurnover) * 1000) / 10
      : 0
    const totalAvgDiscountPercent = discountCount > 0
      ? Math.round((totalDiscountSum / discountCount) * 10) / 10
      : 0
    const medianCustomerAge = ageCount > 0
      ? Math.round(ageSum / ageCount)
      : null

    return {
      variantNumber: raw.variantNumber,
      variantName: raw.variantName,
      image: null,
      totalSalesQuantity,
      totalReturnQuantity,
      totalReturnRate,
      totalTurnover: Math.round(totalTurnover),
      totalCosts: Math.round(totalCosts),
      totalTb: Math.round(totalTb),
      totalTbPercent,
      totalAvgDiscountPercent,
      medianCustomerAge,
      periods,
    }
  })
}

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const company = searchParams.get('company') as Exclude<CompanyId, 'all'>
  const productNumber = searchParams.get('productNumber')
  const periodMonths = parseInt(searchParams.get('periodMonths') || '12', 10)
  const force = searchParams.get('force') === 'true'

  // Determine which period indices to include in totals based on selected period
  // 12 months = all 4 periods (0,1,2,3), 9 months = (0,1,2), 6 months = (0,1), 3 months = (0), 1 month = (0)
  const periodsToIncludeInTotals = new Set<number>()
  if (periodMonths >= 12) {
    periodsToIncludeInTotals.add(0).add(1).add(2).add(3)
  } else if (periodMonths >= 9) {
    periodsToIncludeInTotals.add(0).add(1).add(2)
  } else if (periodMonths >= 6) {
    periodsToIncludeInTotals.add(0).add(1)
  } else {
    periodsToIncludeInTotals.add(0) // 3 months or 1 month
  }

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter. Must be "varg" or "sneaky-steve"' },
      { status: 400 }
    )
  }

  if (!productNumber) {
    return NextResponse.json(
      { error: 'Missing productNumber parameter' },
      { status: 400 }
    )
  }

  const cacheKey = getCacheKey(company, productNumber, periodMonths)

  // Check cache (unless force refresh)
  if (!force) {
    const cached = getFromCache(cacheKey)
    if (cached) {
      return NextResponse.json({
        data: cached.data,
        previousVariants: cached.previousVariants,
        cachedAt: cached.cachedAt.toISOString(),
        fromCache: true,
      })
    }
  }

  try {
    const env: Env = process.env as unknown as Env
    const es = new ElasticsearchConnector(env)

    // Fetch current and previous year variant data in parallel
    const [currentResult, previousResult] = await Promise.all([
      es.fetchProductPerformanceDetail(company, productNumber, 0),
      es.fetchProductPerformanceDetail(company, productNumber, 1),
    ])

    // Generate period definitions (always rolling 12 months)
    const { definitions: periodDefinitions, keyToIndex: periodKeyToIndex } = generatePeriodDefinitions()

    // Transform current year data
    const variants = transformVariants(
      currentResult.variants,
      periodDefinitions,
      periodKeyToIndex,
      periodsToIncludeInTotals
    )

    // Transform previous year data (for comparison)
    const previousVariants = transformVariants(
      previousResult.variants,
      periodDefinitions,
      periodKeyToIndex,
      periodsToIncludeInTotals
    )

    // Sort variants by total sales (descending)
    variants.sort((a, b) => b.totalSalesQuantity - a.totalSalesQuantity)

    // Calculate product-level summary
    const productSummary = variants.reduce(
      (acc, v) => ({
        salesQuantity: acc.salesQuantity + v.totalSalesQuantity,
        returnQuantity: acc.returnQuantity + v.totalReturnQuantity,
        turnover: acc.turnover + v.totalTurnover,
        costs: acc.costs + v.totalCosts,
      }),
      { salesQuantity: 0, returnQuantity: 0, turnover: 0, costs: 0 }
    )

    const tb = productSummary.turnover - productSummary.costs
    const tbPercent = productSummary.turnover > 0
      ? Math.round((tb / productSummary.turnover) * 1000) / 10
      : 0
    const returnRate = productSummary.salesQuantity > 0
      ? Math.round((productSummary.returnQuantity / productSummary.salesQuantity) * 1000) / 10
      : 0

    const data: ProductPerformanceDetail = {
      productNumber,
      productName: variants[0]?.variantName.split(' - ')[0] || productNumber, // Extract base name
      image: null,
      summary: {
        productNumber,
        productName: variants[0]?.variantName.split(' - ')[0] || productNumber,
        salesQuantity: productSummary.salesQuantity,
        returnQuantity: productSummary.returnQuantity,
        returnRate,
        orderCount: 0, // Not available at this level
        turnover: productSummary.turnover,
        turnoverBeforeReturns: productSummary.turnover,
        costs: productSummary.costs,
        tb,
        tbPercent,
        tbWithAds: tb,
        tbPercentWithAds: tbPercent,
        medianCustomerAge: null,
        avgDiscountPercent: 0,
      },
      variants,
      periodDefinitions,
    }

    // Store in cache
    const cachedAt = new Date()
    detailCache.set(cacheKey, { data, previousVariants, cachedAt })

    return NextResponse.json({
      data,
      previousVariants,
      cachedAt: cachedAt.toISOString(),
      fromCache: false,
    })
  } catch (error) {
    console.error('Failed to fetch performance detail:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance detail' },
      { status: 500 }
    )
  }
}
