import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { ElasticsearchConnector } from '@/lib/connectors/elasticsearch'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type { AdCostDocument, AdCostsResponse } from '@/types/ad-costs'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

// Simple in-memory cache
const adCostsCache: Map<string, { costs: AdCostDocument[]; cachedAt: Date }> = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getFromCache(company: string): { costs: AdCostDocument[]; cachedAt: Date } | null {
  const cached = adCostsCache.get(company)
  if (!cached) return null

  const age = Date.now() - cached.cachedAt.getTime()
  if (age > CACHE_TTL_MS) {
    adCostsCache.delete(company)
    return null
  }

  return cached
}

function invalidateCache(company: string): void {
  adCostsCache.delete(company)
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
      const response: AdCostsResponse = {
        costs: cached.costs,
        cachedAt: cached.cachedAt.toISOString(),
        fromCache: true,
      }
      return NextResponse.json(response)
    }
  }

  try {
    const env: Env = process.env as unknown as Env
    const es = new ElasticsearchConnector(env)

    const costs = await es.fetchAdCosts(company)

    // Store in cache
    adCostsCache.set(company, { costs, cachedAt: new Date() })

    const response: AdCostsResponse = {
      costs,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch ad costs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ad costs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { company, year, month, metaCost, googleCost } = body

    // Validate params
    if (!company || !VALID_COMPANIES.includes(company)) {
      return NextResponse.json(
        { error: 'Invalid company parameter' },
        { status: 400 }
      )
    }

    if (!year || !month || typeof metaCost !== 'number' || typeof googleCost !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: year, month, metaCost, googleCost' },
        { status: 400 }
      )
    }

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Month must be between 1 and 12' },
        { status: 400 }
      )
    }

    if (metaCost < 0 || googleCost < 0) {
      return NextResponse.json(
        { error: 'Costs cannot be negative' },
        { status: 400 }
      )
    }

    const env: Env = process.env as unknown as Env
    const es = new ElasticsearchConnector(env)

    await es.saveAdCost(company, { year, month, metaCost, googleCost })

    // Invalidate cache
    invalidateCache(company)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save ad cost:', error)
    return NextResponse.json(
      { error: 'Failed to save ad cost' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const company = searchParams.get('company') as Exclude<CompanyId, 'all'>
  const year = parseInt(searchParams.get('year') || '')
  const month = parseInt(searchParams.get('month') || '')

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter' },
      { status: 400 }
    )
  }

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Invalid year or month parameter' },
      { status: 400 }
    )
  }

  try {
    const env: Env = process.env as unknown as Env
    const es = new ElasticsearchConnector(env)

    await es.deleteAdCost(company, year, month)

    // Invalidate cache
    invalidateCache(company)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete ad cost:', error)
    return NextResponse.json(
      { error: 'Failed to delete ad cost' },
      { status: 500 }
    )
  }
}
