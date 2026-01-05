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

// Period key to index mapping (0 = most recent)
const PERIOD_KEY_TO_INDEX: Record<string, number> = {
  '0-3m': 0,
  '3-6m': 1,
  '6-9m': 2,
  '9-12m': 3,
}

// Generate period labels based on day ranges
function generatePeriodDefinitions(): RollingPeriod[] {
  const now = new Date()
  const periods: RollingPeriod[] = []

  // Period labels: 0-90d, 90-180d, 180-270d, 270-365d
  const periodLabels = ['0-90d', '90-180d', '180-270d', '270-365d']

  for (let i = 0; i < 4; i++) {
    const endDate = new Date(now)
    endDate.setMonth(endDate.getMonth() - (i * 3))

    const startDate = new Date(endDate)
    startDate.setMonth(startDate.getMonth() - 3)

    periods.push({
      label: periodLabels[i],
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      periodIndex: i,
    })
  }

  return periods
}

// Simple in-memory cache
const detailCache: Map<string, { data: ProductPerformanceDetail; cachedAt: Date }> = new Map()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function getCacheKey(company: string, productNumber: string): string {
  return `${company}:${productNumber}`
}

function getFromCache(key: string): { data: ProductPerformanceDetail; cachedAt: Date } | null {
  const cached = detailCache.get(key)
  if (!cached) return null

  const age = Date.now() - cached.cachedAt.getTime()
  if (age > CACHE_TTL_MS) {
    detailCache.delete(key)
    return null
  }

  return cached
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
  const force = searchParams.get('force') === 'true'

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

  const cacheKey = getCacheKey(company, productNumber)

  // Check cache (unless force refresh)
  if (!force) {
    const cached = getFromCache(cacheKey)
    if (cached) {
      return NextResponse.json({
        data: cached.data,
        cachedAt: cached.cachedAt.toISOString(),
        fromCache: true,
      })
    }
  }

  try {
    const env: Env = process.env as unknown as Env
    const es = new ElasticsearchConnector(env)

    // Fetch variant/period data from ES
    const { variants: rawVariants } = await es.fetchProductPerformanceDetail(
      company,
      productNumber
    )

    // Generate period definitions
    const periodDefinitions = generatePeriodDefinitions()

    // Transform raw data to typed structure
    const variants: VariantPerformance[] = rawVariants.map(raw => {
      // Calculate totals across all periods
      let totalSalesQuantity = 0
      let totalReturnQuantity = 0
      let totalTurnover = 0
      let totalCosts = 0
      let totalDiscountSum = 0
      let discountCount = 0
      let ageSum = 0
      let ageCount = 0

      const periods: PeriodMetrics[] = raw.periods.map(rawPeriod => {
        const periodIndex = PERIOD_KEY_TO_INDEX[rawPeriod.periodKey] ?? 0
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

        // Accumulate totals
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
        image: null, // Could be fetched separately if needed
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
    detailCache.set(cacheKey, { data, cachedAt: new Date() })

    return NextResponse.json({
      data,
      cachedAt: new Date().toISOString(),
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
