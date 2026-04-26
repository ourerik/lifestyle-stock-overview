import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import {
  readGlobalReference,
  removeGlobalReference,
} from '@/lib/storage/product-media-storage'
import { canUseProductMedia, type CompanyId } from '@/config/companies'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const company = request.nextUrl.searchParams.get('company')
  if (!company || !canUseProductMedia(company as CompanyId)) {
    return NextResponse.json(
      { error: 'Product media is not available for this company' },
      { status: 400 },
    )
  }

  try {
    const obj = await readGlobalReference(company, id)
    if (!obj) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
    }

    const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream'
    return new NextResponse(obj.body as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to read global reference:', error)
    return NextResponse.json(
      { error: 'Failed to read reference', details: message },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const company = request.nextUrl.searchParams.get('company')
  if (!company || !canUseProductMedia(company as CompanyId)) {
    return NextResponse.json(
      { error: 'Product media is not available for this company' },
      { status: 400 },
    )
  }

  try {
    const metadata = await removeGlobalReference(company, id)
    return NextResponse.json({ references: metadata.references })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to delete global reference:', error)
    return NextResponse.json(
      { error: 'Kunde inte ta bort referens', details: message },
      { status: 500 },
    )
  }
}
