import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { InventoryAggregator } from '@/lib/services/inventory-aggregator'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

// Simple in-memory cache for inventory data
let inventoryCache: Map<string, { data: unknown; cachedAt: Date }> = new Map()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getCacheKey(company: string): string {
  return company
}

function getFromCache(company: string): { data: unknown; cachedAt: Date } | null {
  const key = getCacheKey(company)
  const cached = inventoryCache.get(key)
  if (!cached) return null

  const age = Date.now() - cached.cachedAt.getTime()
  if (age > CACHE_TTL_MS) {
    inventoryCache.delete(key)
    return null
  }

  return cached
}

function setInCache(company: string, data: unknown): void {
  const key = getCacheKey(company)
  inventoryCache.set(key, { data, cachedAt: new Date() })
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
    const data = await aggregator.fetchInventory(company)

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
