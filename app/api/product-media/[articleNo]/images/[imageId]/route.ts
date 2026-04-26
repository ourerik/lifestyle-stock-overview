import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { readImage } from '@/lib/storage/product-media-storage'
import { canUseProductMedia, type CompanyId } from '@/config/companies'

interface RouteContext {
  params: Promise<{ articleNo: string; imageId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { articleNo, imageId } = await context.params
  const company = request.nextUrl.searchParams.get('company')
  if (!company || !canUseProductMedia(company as CompanyId)) {
    return NextResponse.json(
      { error: 'Product media is not available for this company' },
      { status: 400 },
    )
  }

  try {
    const obj = await readImage(company, articleNo, imageId)
    if (!obj) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    return new NextResponse(obj.body as ReadableStream, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Failed to read generated image:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to read image', details: message },
      { status: 500 },
    )
  }
}
