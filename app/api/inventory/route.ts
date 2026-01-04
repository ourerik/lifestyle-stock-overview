import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { InventoryAggregator } from '@/lib/services/inventory-aggregator'
import { FifoCalculator } from '@/lib/services/fifo-calculator'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type { InventoryData, InventoryFetchResult } from '@/types/inventory'
import type { FifoValuationData } from '@/types/fifo'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

// Simple in-memory cache for inventory data
const inventoryCache: Map<string, { data: InventoryData; cachedAt: Date }> = new Map()
const fifoCache: Map<string, { data: FifoValuationData; cachedAt: Date }> = new Map()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getFromCache(company: string): { data: InventoryData; cachedAt: Date } | null {
  const cached = inventoryCache.get(company)
  if (!cached) return null

  const age = Date.now() - cached.cachedAt.getTime()
  if (age > CACHE_TTL_MS) {
    inventoryCache.delete(company)
    return null
  }

  return cached
}

function setInCache(company: string, data: InventoryData): void {
  inventoryCache.set(company, { data, cachedAt: new Date() })
}

function getFifoFromCache(company: string): FifoValuationData | null {
  const cached = fifoCache.get(company)
  if (!cached) return null

  const age = Date.now() - cached.cachedAt.getTime()
  if (age > CACHE_TTL_MS) {
    fifoCache.delete(company)
    return null
  }

  return cached.data
}

function setFifoInCache(company: string, data: FifoValuationData): void {
  fifoCache.set(company, { data, cachedAt: new Date() })
}

function mergeWithFifo(inventoryData: InventoryData, fifoData: FifoValuationData): InventoryData {
  // Build a map of productNumber -> FIFO values
  const fifoMap = new Map<string, { totalValue: number; averageCost: number }>()
  for (const product of fifoData.products) {
    fifoMap.set(product.productNumber, {
      totalValue: product.totalValue,
      averageCost: product.averageCost,
    })
  }

  // Merge FIFO data into each product
  const productsWithFifo = inventoryData.products.map(product => {
    const fifo = fifoMap.get(product.productNumber)
    return {
      ...product,
      fifoValue: fifo?.totalValue,
      fifoCost: fifo?.averageCost,
    }
  })

  return {
    ...inventoryData,
    products: productsWithFifo,
    fifoSummary: fifoData.summary,  // Include FIFO summary with location breakdown
  }
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
  const force = searchParams.get('force') === 'true'

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
    const aggregator = new InventoryAggregator(env)
    const fetchResult = await aggregator.fetchInventory(company)

    // Extract zettleInventory for FIFO calculator, keep inventoryData for response
    const { zettleInventory, ...inventoryData } = fetchResult

    // Fetch FIFO data (from cache if available)
    let fifoData = getFifoFromCache(company)
    if (!fifoData) {
      try {
        const calculator = new FifoCalculator(env)
        // Pass Zettle inventory for Sneaky Steve to include store stock in valuation
        fifoData = await calculator.calculateValuation(company, zettleInventory.size > 0 ? zettleInventory : undefined)
        setFifoInCache(company, fifoData)
      } catch (fifoError) {
        console.error('Failed to fetch FIFO data (continuing without it):', fifoError)
      }
    }

    // Merge FIFO data with inventory
    const data = fifoData ? mergeWithFifo(inventoryData, fifoData) : inventoryData

    // Store in cache
    setInCache(company, data)

    return NextResponse.json({
      data,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    })
  } catch (error) {
    console.error('Failed to fetch inventory data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory data' },
      { status: 500 }
    )
  }
}
