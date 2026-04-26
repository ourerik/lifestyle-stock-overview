import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { CentraConnector } from '@/lib/connectors/centra'
import { getMetadata } from '@/lib/storage/product-media-storage'
import {
  canUseProductMedia,
  getCentraEnvPrefix,
  type CompanyId,
} from '@/config/companies'
import type { Env } from '@/types'
import type { ProductMediaDetail } from '@/types/product-media'

interface RouteContext {
  params: Promise<{ articleNo: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { articleNo } = await context.params
  const company = request.nextUrl.searchParams.get('company')

  if (!company || !canUseProductMedia(company as CompanyId)) {
    return NextResponse.json(
      { error: 'Product media is not available for this company' },
      { status: 400 },
    )
  }

  try {
    const env: Env = process.env as unknown as Env
    const centra = new CentraConnector(
      env,
      getCentraEnvPrefix(company as CompanyId),
      false,
    )

    const [displays, metadata] = await Promise.all([
      centra.fetchDisplayItems(),
      getMetadata(company, articleNo),
    ])

    // articleNo in the URL is display.id (unique per color variant)
    const display = displays.find((d) => String(d.id) === articleNo)
    if (!display) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const firstItemId = display.displayItems?.[0]?.id

    const detail: ProductMediaDetail = {
      displayItemId: firstItemId ? String(firstItemId) : String(display.id),
      articleNo,
      productNumber: display.product?.productNumber || '',
      displayName: display.name || display.product?.name || display.uri,
      productName: display.product?.name || display.name || '',
      status: display.product?.status || display.status,
      categories: (display.categories || []).map((c) => c.name),
      images: (display.media || []).map((m) => m.source.url),
      generated: metadata?.generated ?? [],
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('Failed to fetch product media detail:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to fetch product media detail', details: message },
      { status: 500 },
    )
  }
}
