import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { ElasticsearchConnector } from '@/lib/connectors/elasticsearch'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type { ProductPerformance, PerformanceData, PerformanceSummary } from '@/types/performance'
import { DEFAULT_AD_COST_PER_ORDER } from '@/types/ad-costs'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

// Simple in-memory cache
const performanceCache: Map<string, { data: PerformanceData; cachedAt: Date }> = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour (shorter than inventory since sales data changes more)

function getCacheKey(company: string, startDate: string, endDate: string): string {
  return `${company}:${startDate}:${endDate}`
}

function getFromCache(key: string): { data: PerformanceData; cachedAt: Date } | null {
  const cached = performanceCache.get(key)
  if (!cached) return null

  const age = Date.now() - cached.cachedAt.getTime()
  if (age > CACHE_TTL_MS) {
    performanceCache.delete(key)
    return null
  }

  return cached
}

function setInCache(key: string, data: PerformanceData): void {
  performanceCache.set(key, { data, cachedAt: new Date() })
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
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const force = searchParams.get('force') === 'true'

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter. Must be "varg" or "sneaky-steve"' },
      { status: 400 }
    )
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing startDate or endDate parameter' },
      { status: 400 }
    )
  }

  const cacheKey = getCacheKey(company, startDate, endDate)

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

  // Fetch fresh data
  try {
    const env: Env = process.env as unknown as Env
    const es = new ElasticsearchConnector(env)

    // Fetch product performance from ES
    const { products: rawProducts, totalOrderCount } = await es.fetchProductPerformance(
      company,
      startDate,
      endDate
    )

    // Fetch ad costs for the period
    const adCosts = await es.fetchAdCosts(company)

    // Calculate ad cost per order for the period
    // Find months that overlap with the date range
    const startMonth = new Date(startDate)
    const endMonth = new Date(endDate)

    let totalAdCost = 0
    let hasAdCosts = false

    for (const cost of adCosts) {
      const costDate = new Date(cost.year, cost.month - 1, 1)
      if (costDate >= new Date(startMonth.getFullYear(), startMonth.getMonth(), 1) &&
          costDate <= new Date(endMonth.getFullYear(), endMonth.getMonth(), 1)) {
        totalAdCost += cost.totalCost
        hasAdCosts = true
      }
    }

    const adCostPerOrder = hasAdCosts && totalOrderCount > 0
      ? totalAdCost / totalOrderCount
      : DEFAULT_AD_COST_PER_ORDER

    // Transform raw products to ProductPerformance with calculated fields
    const products: ProductPerformance[] = rawProducts.map(raw => {
      const returnRate = raw.salesQuantity > 0
        ? (raw.returnQuantity / raw.salesQuantity) * 100
        : 0

      const tb = raw.turnover - raw.costs
      const tbPercent = raw.turnover > 0 ? (tb / raw.turnover) * 100 : 0

      const adCostForProduct = adCostPerOrder * raw.orderCount
      const tbWithAds = tb - adCostForProduct
      const tbPercentWithAds = raw.turnover > 0 ? (tbWithAds / raw.turnover) * 100 : 0

      return {
        productNumber: raw.productNumber,
        productName: raw.productName,
        salesQuantity: raw.salesQuantity,
        returnQuantity: raw.returnQuantity,
        returnRate: Math.round(returnRate * 10) / 10,
        orderCount: raw.orderCount,
        turnover: Math.round(raw.turnover),
        turnoverBeforeReturns: Math.round(raw.turnoverBeforeReturns),
        costs: Math.round(raw.costs),
        tb: Math.round(tb),
        tbPercent: Math.round(tbPercent * 10) / 10,
        tbWithAds: Math.round(tbWithAds),
        tbPercentWithAds: Math.round(tbPercentWithAds * 10) / 10,
        medianCustomerAge: (raw as unknown as { medianAge: number | null }).medianAge || null,
        avgDiscountPercent: Math.round(raw.avgDiscountPercent * 10) / 10,
      }
    })

    // Calculate summary
    const totalSalesQuantity = products.reduce((sum, p) => sum + p.salesQuantity, 0)

    // Calculate weighted average discount (weighted by sales quantity)
    const weightedDiscountSum = products.reduce((sum, p) => sum + (p.avgDiscountPercent * p.salesQuantity), 0)
    const totalAvgDiscountPercent = totalSalesQuantity > 0
      ? Math.round((weightedDiscountSum / totalSalesQuantity) * 10) / 10
      : 0

    const summary: PerformanceSummary = {
      totalSalesQuantity,
      totalReturnQuantity: products.reduce((sum, p) => sum + p.returnQuantity, 0),
      totalReturnRate: 0,
      totalTurnover: products.reduce((sum, p) => sum + p.turnover, 0),
      totalCosts: products.reduce((sum, p) => sum + p.costs, 0),
      totalTb: products.reduce((sum, p) => sum + p.tb, 0),
      totalTbPercent: 0,
      totalTbWithAds: products.reduce((sum, p) => sum + p.tbWithAds, 0),
      totalTbPercentWithAds: 0,
      totalAvgDiscountPercent,
      productCount: products.length,
      orderCount: totalOrderCount,
    }

    // Calculate percentages from totals
    summary.totalReturnRate = summary.totalSalesQuantity > 0
      ? Math.round((summary.totalReturnQuantity / summary.totalSalesQuantity) * 1000) / 10
      : 0
    summary.totalTbPercent = summary.totalTurnover > 0
      ? Math.round((summary.totalTb / summary.totalTurnover) * 1000) / 10
      : 0
    summary.totalTbPercentWithAds = summary.totalTurnover > 0
      ? Math.round((summary.totalTbWithAds / summary.totalTurnover) * 1000) / 10
      : 0

    const data: PerformanceData = {
      products,
      summary,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      adCostPerOrder: Math.round(adCostPerOrder),
    }

    // Store in cache
    setInCache(cacheKey, data)

    return NextResponse.json({
      data,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    })
  } catch (error) {
    console.error('Failed to fetch performance data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}
