import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { CentraConnector } from '@/lib/connectors/centra'
import { listGeneratedCountsByArticle } from '@/lib/storage/product-media-storage'
import {
  canUseProductMedia,
  getCentraEnvPrefix,
  type CompanyId,
} from '@/config/companies'
import type { Env } from '@/types'
import type {
  ProductMediaItem,
  ProductMediaListResponse,
} from '@/types/product-media'

type CacheEntry = {
  products: ProductMediaItem[]
  categories: string[]
  cachedAt: Date
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000

function getFromCache(company: string): CacheEntry | null {
  const entry = cache.get(company)
  if (!entry) return null
  if (Date.now() - entry.cachedAt.getTime() > CACHE_TTL_MS) {
    cache.delete(company)
    return null
  }
  return entry
}

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const company = searchParams.get('company')
  const force = searchParams.get('force') === 'true'

  if (!company || !canUseProductMedia(company as CompanyId)) {
    return NextResponse.json(
      { error: 'Product media is not available for this company' },
      { status: 400 },
    )
  }

  if (!force) {
    const cached = getFromCache(company)
    if (cached) {
      const response: ProductMediaListResponse = {
        products: cached.products,
        categories: cached.categories,
        cachedAt: cached.cachedAt.toISOString(),
        fromCache: true,
      }
      return NextResponse.json(response)
    }
  }

  try {
    const env: Env = process.env as unknown as Env
    const centra = new CentraConnector(
      env,
      getCentraEnvPrefix(company as CompanyId),
      false,
    )

    const [displays, generatedCountByArticle] = await Promise.all([
      centra.fetchDisplayItems(),
      listGeneratedCountsByArticle(company),
    ])

    // Exclude end-of-life lifecycle statuses. display.status is already
    // filtered to ACTIVE in the GraphQL query, so only product.status varies.
    const excludedProductStatuses = new Set(['DISCONTINUED', 'INACTIVE', 'ARCHIVED'])

    const categorySet = new Set<string>()
    const products: ProductMediaItem[] = []

    for (const display of displays) {
      const firstItemId = display.displayItems?.[0]?.id
      if (!firstItemId) continue

      const productStatus = display.product?.status
      if (productStatus && excludedProductStatuses.has(productStatus.toUpperCase())) {
        continue
      }

      // display.id is unique per color variant; product.productNumber is the
      // style number and is shared between all colors – use display.id for nav.
      const articleNo = String(display.id)
      const productNumber = display.product?.productNumber || ''
      const categories = (display.categories || []).map((c) => c.name)
      categories.forEach((c) => categorySet.add(c))

      products.push({
        displayItemId: String(firstItemId),
        articleNo,
        productNumber,
        displayName: display.name || display.product?.name || display.uri,
        productName: display.product?.name || display.name || '',
        status: productStatus || display.status,
        categories,
        images: (display.media || []).map((m) => m.source.url),
        generatedCount: generatedCountByArticle.get(articleNo) ?? 0,
      })
    }

    products.sort((a, b) => a.displayName.localeCompare(b.displayName, 'sv'))
    const categories = Array.from(categorySet).sort((a, b) =>
      a.localeCompare(b, 'sv'),
    )

    cache.set(company, { products, categories, cachedAt: new Date() })

    const response: ProductMediaListResponse = {
      products,
      categories,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch product media list:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to fetch product media list', details: message },
      { status: 500 },
    )
  }
}
