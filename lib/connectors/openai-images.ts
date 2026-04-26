import type {
  ImageQuality,
  ImageSize,
} from '@/types/product-media'

// We call OpenAI's REST API directly rather than through the npm SDK so we
// can target gpt-image-2 with its current parameters (quality tiers, partial
// image streaming) regardless of what shapes the SDK's types carry.
const MODEL = 'gpt-image-2'
const API_BASE = 'https://api.openai.com/v1'
const MAX_REFERENCE_IMAGES = 16

export interface ReferenceBlob {
  blob: Blob
  name: string  // filename hint sent to OpenAI
}

export interface GenerateOptions {
  prompt: string
  references: ReferenceBlob[]
  size: ImageSize
  quality: ImageQuality
}

export interface GenerateResult {
  pngBytes: ArrayBuffer
}

export type StreamEvent =
  | { type: 'partial'; index: number; b64: string }
  | { type: 'complete'; b64: string }

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>
  error?: { message?: string; type?: string; code?: string }
}

export class OpenAIImagesConnector {
  private apiKey: string

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Missing OPEN_API_KEY')
    }
    this.apiKey = apiKey
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    let finalB64: string | undefined
    for await (const ev of this.generateStream(options)) {
      if (ev.type === 'complete') finalB64 = ev.b64
    }
    if (!finalB64) throw new Error('OpenAI returnerade ingen färdig bild')
    return { pngBytes: base64ToArrayBuffer(finalB64) }
  }

  /**
   * Streams events as OpenAI delivers partial frames. gpt-image-2 supports
   * `partial_images: 0-3`; we ask for 2 to balance responsiveness vs cost.
   */
  async *generateStream(
    options: GenerateOptions,
    partialImages = 2,
  ): AsyncGenerator<StreamEvent> {
    const { prompt, references, size, quality } = options

    if (!prompt.trim()) throw new Error('Prompt får inte vara tom')
    if (references.length > MAX_REFERENCE_IMAGES) {
      throw new Error(
        `Max ${MAX_REFERENCE_IMAGES} referensbilder, du skickade ${references.length}`,
      )
    }

    const res =
      references.length === 0
        ? await this.openGenerationsStream({ prompt, size, quality, partialImages })
        : await this.openEditsStream({
            prompt,
            references,
            size,
            quality,
            partialImages,
          })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(
        `OpenAI ${res.status}: ${parseErrorMessage(text) ?? text.slice(0, 300)}`,
      )
    }
    if (!res.body) throw new Error('OpenAI: tomt svar-body')

    yield* parseOpenAISseStream(res.body)
  }

  private async openGenerationsStream(args: {
    prompt: string
    size: ImageSize
    quality: ImageQuality
    partialImages: number
  }): Promise<Response> {
    const body: Record<string, unknown> = {
      model: MODEL,
      prompt: args.prompt,
      size: args.size,
      quality: args.quality,
      n: 1,
      stream: true,
      partial_images: args.partialImages,
    }
    return fetch(`${API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    })
  }

  private async openEditsStream(args: {
    prompt: string
    references: ReferenceBlob[]
    size: ImageSize
    quality: ImageQuality
    partialImages: number
  }): Promise<Response> {
    const form = new FormData()
    form.append('model', MODEL)
    form.append('prompt', args.prompt)
    form.append('size', args.size)
    form.append('quality', args.quality)
    form.append('n', '1')
    form.append('stream', 'true')
    form.append('partial_images', String(args.partialImages))

    const fieldName =
      args.references.length > 1 ? 'image[]' : 'image'

    for (const [i, ref] of args.references.entries()) {
      form.append(fieldName, ref.blob, ref.name || `reference-${i}.png`)
    }

    return fetch(`${API_BASE}/images/edits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream',
      },
      body: form,
    })
  }

  /** Non-streaming fallback — kept for callers that want a single result. */
  async generateNonStreaming(options: GenerateOptions): Promise<GenerateResult> {
    return this.generate(options)
  }
}

async function* parseOpenAISseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  // Track partial image index across frames.
  let partialIndex = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line (\n\n). Accumulate until we
    // have complete frames.
    let sepIndex = buffer.indexOf('\n\n')
    while (sepIndex !== -1) {
      const rawFrame = buffer.slice(0, sepIndex)
      buffer = buffer.slice(sepIndex + 2)
      sepIndex = buffer.indexOf('\n\n')

      // Each frame may have multiple "data:" lines — concatenate them.
      const dataLines = rawFrame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())

      if (dataLines.length === 0) continue
      const dataStr = dataLines.join('')
      if (dataStr === '[DONE]') return

      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(dataStr) as Record<string, unknown>
      } catch {
        continue
      }

      const b64 = typeof payload.b64_json === 'string' ? payload.b64_json : undefined
      const type = typeof payload.type === 'string' ? payload.type : ''

      if (!b64) continue

      if (type.endsWith('.partial_image')) {
        const idx =
          typeof payload.partial_image_index === 'number'
            ? payload.partial_image_index
            : partialIndex
        partialIndex = idx + 1
        yield { type: 'partial', index: idx, b64 }
      } else if (type.endsWith('.completed')) {
        yield { type: 'complete', b64 }
      }
    }
  }
}

function parseErrorMessage(text: string): string | undefined {
  try {
    const json = JSON.parse(text) as OpenAIImageResponse
    return json.error?.message
  } catch {
    return undefined
  }
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
