import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import {
  OpenAIImagesConnector,
  type ReferenceBlob,
} from '@/lib/connectors/openai-images'
import {
  appendGeneratedImage,
  readGlobalReference,
  readImage,
} from '@/lib/storage/product-media-storage'
import { canUseProductMedia, type CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type {
  GenerateImageRequest,
  GeneratedImage,
  ImageQuality,
  ImageSize,
} from '@/types/product-media'

interface RouteContext {
  params: Promise<{ articleNo: string }>
}

const VALID_SIZES: ImageSize[] = [
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '2000x1000',
  '1000x2000',
  '2000x667',
  '667x2000',
]
const VALID_QUALITIES: ImageQuality[] = ['low', 'medium', 'high']

export async function POST(request: NextRequest, context: RouteContext) {
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

  let body: GenerateImageRequest
  try {
    body = (await request.json()) as GenerateImageRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { prompt, referenceImageUrls, size, quality } = body

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'Prompt är obligatorisk' }, { status: 400 })
  }
  if (!VALID_SIZES.includes(size)) {
    return NextResponse.json({ error: 'Ogiltig storlek' }, { status: 400 })
  }
  if (!VALID_QUALITIES.includes(quality)) {
    return NextResponse.json({ error: 'Ogiltig kvalitet' }, { status: 400 })
  }
  if (!Array.isArray(referenceImageUrls)) {
    return NextResponse.json(
      { error: 'referenceImageUrls måste vara en array' },
      { status: 400 },
    )
  }

  const env: Env = process.env as unknown as Env
  const apiKey = env.OPEN_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPEN_API_KEY saknas i miljön' },
      { status: 500 },
    )
  }

  const connector = new OpenAIImagesConnector(apiKey)
  const encoder = new TextEncoder()
  const writeEvent = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    event: Record<string, unknown>,
  ) => {
    controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const references = await resolveReferences(company, referenceImageUrls)

        let finalB64: string | undefined

        for await (const ev of connector.generateStream({
          prompt: prompt.trim(),
          references,
          size,
          quality,
        })) {
          if (ev.type === 'partial') {
            writeEvent(controller, {
              type: 'partial',
              index: ev.index,
              b64: ev.b64,
            })
          } else if (ev.type === 'complete') {
            finalB64 = ev.b64
            writeEvent(controller, { type: 'complete' })
          }
        }

        if (!finalB64) {
          throw new Error('OpenAI returnerade ingen färdig bild')
        }

        const id = crypto.randomUUID()
        const image: GeneratedImage = {
          id,
          createdAt: new Date().toISOString(),
          prompt: prompt.trim(),
          referenceImageUrls,
          size,
          quality,
          url: `/api/product-media/${encodeURIComponent(articleNo)}/images/${id}?company=${encodeURIComponent(company)}`,
        }

        const pngBytes = base64ToArrayBuffer(finalB64)
        await appendGeneratedImage(company, articleNo, image, pngBytes)

        writeEvent(controller, { type: 'done', image })
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Failed to generate product image:', err)
        writeEvent(controller, { type: 'error', message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Resolve caller-supplied reference URLs into Blobs. URLs pointing at our
 * own API are served directly from R2 (no HTTP round-trip, no auth needed);
 * absolute external URLs (e.g. Centra CDN) are fetched.
 */
async function resolveReferences(
  company: string,
  urls: string[],
): Promise<ReferenceBlob[]> {
  const results: ReferenceBlob[] = []
  for (const [i, rawUrl] of urls.entries()) {
    const resolved = await resolveSingleReference(company, rawUrl, i)
    results.push(resolved)
  }
  return results
}

async function resolveSingleReference(
  company: string,
  rawUrl: string,
  index: number,
): Promise<ReferenceBlob> {
  // Our own URLs are relative (start with `/api/product-media/...`). Parse and
  // read from R2 directly instead of going out over HTTP.
  if (rawUrl.startsWith('/api/product-media/')) {
    const [pathname, search] = rawUrl.split('?')
    const params = new URLSearchParams(search || '')
    const urlCompany = params.get('company') || company

    const globalMatch = pathname.match(
      /^\/api\/product-media\/global-references\/([^/?]+)$/,
    )
    if (globalMatch) {
      const obj = await readGlobalReference(urlCompany, globalMatch[1])
      if (!obj) {
        throw new Error(
          `Referens #${index + 1}: global referens hittades inte (${globalMatch[1]})`,
        )
      }
      const contentType = obj.httpMetadata?.contentType ?? 'image/png'
      const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png'
      const bytes = await obj.arrayBuffer()
      return {
        blob: new Blob([bytes], { type: contentType }),
        name: `global-${index}.${ext}`,
      }
    }

    const generatedMatch = pathname.match(
      /^\/api\/product-media\/([^/]+)\/images\/([^/?]+)$/,
    )
    if (generatedMatch) {
      const [, articleNo, imageId] = generatedMatch
      const obj = await readImage(
        urlCompany,
        decodeURIComponent(articleNo),
        imageId,
      )
      if (!obj) {
        throw new Error(
          `Referens #${index + 1}: genererad bild hittades inte (${imageId})`,
        )
      }
      const bytes = await obj.arrayBuffer()
      return {
        blob: new Blob([bytes], { type: 'image/png' }),
        name: `generated-${index}.png`,
      }
    }

    throw new Error(
      `Referens #${index + 1}: kände inte igen URL-mönstret "${rawUrl}"`,
    )
  }

  // External URL — fetch directly
  const fetched = await fetch(rawUrl)
  if (!fetched.ok) {
    throw new Error(
      `Kunde inte hämta referensbild #${index + 1}: ${fetched.status}`,
    )
  }
  const contentType = fetched.headers.get('content-type') || 'image/png'
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png'
  const bytes = await fetched.arrayBuffer()
  return {
    blob: new Blob([bytes], { type: contentType }),
    name: `reference-${index}.${ext}`,
  }
}
