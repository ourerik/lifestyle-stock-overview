import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { FifoCalculator } from '@/lib/services/fifo-calculator'
import { ZettleConnector } from '@/lib/connectors/zettle'
import { COMPANIES, type CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type { FifoValuationData } from '@/types/fifo'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

// Simple in-memory cache for valuation data
let valuationCache: Map<string, { data: FifoValuationData; cachedAt: Date }> = new Map()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getFromCache(company: string): { data: FifoValuationData; cachedAt: Date } | null {
  const cached = valuationCache.get(company)
  if (!cached) return null

  const age = Date.now() - cached.cachedAt.getTime()
  if (age > CACHE_TTL_MS) {
    valuationCache.delete(company)
    return null
  }

  return cached
}

function setInCache(company: string, data: FifoValuationData): void {
  valuationCache.set(company, { data, cachedAt: new Date() })
}

/**
 * GET /api/inventory/valuation
 *
 * Returns FIFO valuation data for inventory, including:
 * - Total value based on purchase costs
 * - Age of inventory (how long items have been in stock)
 * - Breakdown by product, variant, and size
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const company = searchParams.get('company') as Exclude<CompanyId, 'all'>
  const force = searchParams.get('force') === 'true'
  const productNumber = searchParams.get('productNumber')

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter. Must be "varg" or "sneaky-steve"' },
      { status: 400 }
    )
  }

  // Check cache (unless force refresh)
  if (!force) {
    const cached = getFromCache(company)
    if (cached) {
      // If product filter requested, filter the cached data
      let data = cached.data
      if (productNumber) {
        data = {
          ...cached.data,
          products: cached.data.products.filter(p => p.productNumber === productNumber),
        }
      }

      return NextResponse.json({
        data,
        cachedAt: cached.cachedAt.toISOString(),
        fromCache: true,
      })
    }
  }

  // Calculate fresh data
  try {
    const env: Env = process.env as unknown as Env

    // Fetch Zettle inventory for Sneaky Steve
    let zettleInventory: Map<string, number> | undefined
    if (company === 'sneaky-steve') {
      try {
        const companyConfig = COMPANIES['sneaky-steve']
        const zettleConfig = companyConfig.connectors?.find(c => c.type === 'zettle')
        if (zettleConfig) {
          const zettle = new ZettleConnector(env, zettleConfig.envPrefix)
          const zettleItems = await zettle.fetchInventory()
          zettleInventory = new Map(zettleItems.map(item => [item.barcode, item.balance]))
        }
      } catch (zettleError) {
        console.error('Failed to fetch Zettle inventory (continuing without it):', zettleError)
      }
    }

    const calculator = new FifoCalculator(env)
    const data = await calculator.calculateValuation(company, zettleInventory)

    // Store in cache
    setInCache(company, data)

    // If product filter requested, filter the result
    let responseData = data
    if (productNumber) {
      responseData = {
        ...data,
        products: data.products.filter(p => p.productNumber === productNumber),
      }
    }

    return NextResponse.json({
      data: responseData,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    })
  } catch (error) {
    console.error('Failed to calculate FIFO valuation:', error)
    return NextResponse.json(
      { error: 'Failed to calculate valuation', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
