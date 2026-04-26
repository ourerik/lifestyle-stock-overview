import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import {
  getGlobalReferencesMetadata,
  addGlobalReference,
} from '@/lib/storage/product-media-storage'
import { canUseProductMedia, type CompanyId } from '@/config/companies'
import type {
  GlobalReference,
  GlobalReferencesListResponse,
} from '@/types/product-media'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function companyGate(company: string | null): NextResponse | null {
  if (!company || !canUseProductMedia(company as CompanyId)) {
    return NextResponse.json(
      { error: 'Product media is not available for this company' },
      { status: 400 },
    )
  }
  return null
}

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const company = request.nextUrl.searchParams.get('company')
  const gate = companyGate(company)
  if (gate) return gate

  try {
    const metadata = await getGlobalReferencesMetadata(company as string)
    const response: GlobalReferencesListResponse = {
      references: metadata.references,
    }
    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to list global references:', error)
    return NextResponse.json(
      { error: 'Failed to list global references', details: message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const company = request.nextUrl.searchParams.get('company')
  const gate = companyGate(company)
  if (gate) return gate

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = form.get('file')
  const label = (form.get('label') as string | null) ?? ''

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field saknas' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Ogiltigt format: ${file.type}. Tillåtna: PNG, JPEG, WebP` },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Filen är för stor (${Math.round(file.size / 1024 / 1024)} MB, max 20 MB)` },
      { status: 400 },
    )
  }

  try {
    const bytes = await file.arrayBuffer()
    const id = crypto.randomUUID()
    const reference: GlobalReference = {
      id,
      createdAt: new Date().toISOString(),
      label: label.trim() || file.name || 'Referens',
      contentType: file.type,
      url: `/api/product-media/global-references/${id}?company=${encodeURIComponent(
        company as string,
      )}`,
    }

    await addGlobalReference(company as string, reference, bytes)

    return NextResponse.json({ reference })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to upload global reference:', error)
    return NextResponse.json(
      { error: 'Kunde inte ladda upp referens', details: message },
      { status: 500 },
    )
  }
}
