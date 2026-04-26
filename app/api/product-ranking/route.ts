import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { CosmosDBConnector } from '@/lib/connectors/cosmosdb'
import { ElasticsearchConnector } from '@/lib/connectors/elasticsearch'
import { CentraConnector, type CentraDisplayItem } from '@/lib/connectors/centra'
import type { Env } from '@/types'
import type { ProductRankItem, ProductRankingData, ProductRankingResponse } from '@/types/product-ranking'

// Simple in-memory cache
let rankingCache: { data: ProductRankingData; cachedAt: Date } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getFromCache(): { data: ProductRankingData; cachedAt: Date } | null {
  if (!rankingCache) return null

  const age = Date.now() - rankingCache.cachedAt.getTime()
  if (age > CACHE_TTL_MS) {
    rankingCache = null
    return null
  }

  return rankingCache
}

function invalidateCache(): void {
  rankingCache = null
}

function displayToRankItem(
  display: CentraDisplayItem,
  displayItemId: string,
  defaultRank: number | null
): ProductRankItem {
  return {
    displayItemId,
    displayName: display.name || display.product?.name || display.uri,
    productName: display.product?.name || display.name || '',
    imageUrl: display.media?.[0]?.source?.url,
    status: display.status,
    defaultRank,
  }
}

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const company = searchParams.get('company')
  const force = searchParams.get('force') === 'true'

  if (company !== 'sneaky-steve') {
    return NextResponse.json(
      { error: 'Product ranking is only available for sneaky-steve' },
      { status: 400 }
    )
  }

  if (!force) {
    const cached = getFromCache()
    if (cached) {
      const response: ProductRankingResponse = {
        data: cached.data,
        cachedAt: cached.cachedAt.toISOString(),
        fromCache: true,
      }
      return NextResponse.json(response)
    }
  }

  try {
    const env: Env = process.env as unknown as Env

    const cosmos = new CosmosDBConnector(env)
    const centra = new CentraConnector(env, 'SNEAKY_CENTRA', false)

    const [ranks, displays] = await Promise.all([
      cosmos.fetchProductRanks(),
      centra.fetchDisplayItems(),
    ])

    // Map displayItemId -> parent display
    const displayItemToDisplay = new Map<string, CentraDisplayItem>()
    for (const display of displays) {
      for (const item of display.displayItems || []) {
        displayItemToDisplay.set(String(item.id), display)
      }
    }

    // Track which displays have been used (to avoid duplicates from multiple displayItems)
    const usedDisplayIds = new Set<number>()

    // Build ranked list from Cosmos DB entries that match a Centra display
    const ranked: ProductRankItem[] = []
    for (const rank of ranks) {
      const display = displayItemToDisplay.get(rank.id)
      if (!display || usedDisplayIds.has(display.id)) continue
      usedDisplayIds.add(display.id)
      ranked.push(displayToRankItem(display, rank.id, rank.defaultRank))
    }

    // Sort ranked by defaultRank descending (highest first)
    ranked.sort((a, b) => (b.defaultRank ?? 0) - (a.defaultRank ?? 0))

    // Build unranked list: displays not already in ranked, picking first displayItem as ID
    const unranked: ProductRankItem[] = []
    for (const display of displays) {
      if (usedDisplayIds.has(display.id)) continue
      const firstItemId = display.displayItems?.[0]?.id
      if (!firstItemId) continue
      unranked.push(displayToRankItem(display, String(firstItemId), null))
    }

    unranked.sort((a, b) => a.displayName.localeCompare(b.displayName, 'sv'))

    const data: ProductRankingData = { ranked, unranked }

    rankingCache = { data, cachedAt: new Date() }

    const response: ProductRankingResponse = {
      data,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch product rankings:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to fetch product rankings', details: message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { ranks } = body as { ranks: Array<{ id: string; defaultRank: number }> }

    if (!Array.isArray(ranks) || ranks.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty ranks array' },
        { status: 400 }
      )
    }

    for (const rank of ranks) {
      if (!rank.id || typeof rank.defaultRank !== 'number') {
        return NextResponse.json(
          { error: 'Each rank must have an id (string) and defaultRank (number)' },
          { status: 400 }
        )
      }
    }

    const env: Env = process.env as unknown as Env
    const cosmos = new CosmosDBConnector(env)

    await cosmos.upsertProductRanks(ranks)

    invalidateCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save product rankings:', error)
    return NextResponse.json(
      { error: 'Failed to save product rankings' },
      { status: 500 }
    )
  }
}

// POST: Sync current Cosmos DB ranks to Elasticsearch display indices
export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const env: Env = process.env as unknown as Env

    // Read current ranks from Cosmos DB to verify data
    const cosmos = new CosmosDBConnector(env)
    const ranks = await cosmos.fetchProductRanks()

    if (ranks.length === 0) {
      return NextResponse.json(
        { error: 'No ranks found in Cosmos DB' },
        { status: 400 }
      )
    }

    const es = new ElasticsearchConnector(env)

    const results = await es.updateDisplayRanks(ranks, [
      'sneaky_display_prod_de',
      'sneaky_display_prod_en',
      'sneaky_display_prod_sv',
    ])

    return NextResponse.json({
      success: true,
      synced: results,
      ranksCount: ranks.length,
    })
  } catch (error) {
    console.error('Failed to sync rankings to Elasticsearch:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to sync rankings to Elasticsearch', details: message },
      { status: 500 }
    )
  }
}
