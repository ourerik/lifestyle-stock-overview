import { AwsClient } from 'aws4fetch'
import type {
  ArticleMediaMetadata,
  GeneratedImage,
  GlobalReference,
  GlobalReferencesMetadata,
} from '@/types/product-media'

// -----------------------------------------------------------------------------
// R2 access via S3-compatible API. This works identically inside a Cloudflare
// Worker, a Container, or local Node — no Workers-specific bindings.
// -----------------------------------------------------------------------------

interface R2Config {
  client: AwsClient
  endpoint: string
  bucket: string
}

let cached: R2Config | undefined

function getR2(): R2Config {
  if (cached) return cached

  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const endpoint = process.env.R2_ENDPOINT?.replace(/\/$/, '')
  const bucket = process.env.R2_BUCKET || 'lifestyle-stock-overview-storage'

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    const present = {
      R2_ACCESS_KEY_ID: !!accessKeyId,
      R2_SECRET_ACCESS_KEY: !!secretAccessKey,
      R2_ENDPOINT: !!endpoint,
      R2_BUCKET: bucket,
    }
    throw new Error(
      `R2 S3 credentials missing — present flags: ${JSON.stringify(present)}`,
    )
  }

  cached = {
    client: new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    }),
    endpoint,
    bucket,
  }
  return cached
}

function objectUrl(key: string): string {
  const { endpoint, bucket } = getR2()
  // Encode each path segment but preserve the slashes so the key shape stays.
  const encoded = key.split('/').map(encodeURIComponent).join('/')
  return `${endpoint}/${bucket}/${encoded}`
}

async function getObject(key: string): Promise<Response | null> {
  const { client } = getR2()
  const res = await client.fetch(objectUrl(key))
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`R2 GET ${key} failed: ${res.status} ${await safeText(res)}`)
  }
  return res
}

async function putObject(
  key: string,
  body: ArrayBuffer | Uint8Array | string,
  contentType: string,
): Promise<void> {
  const { client } = getR2()

  // R2's S3 API rejects PUTs without Content-Length. Normalise to Uint8Array
  // so we know the exact byte length (strings need UTF-8 encoding, not char
  // count) and aws4fetch can sign with a length matching the actual payload.
  const bytes =
    typeof body === 'string'
      ? new TextEncoder().encode(body)
      : body instanceof Uint8Array
        ? body
        : new Uint8Array(body)

  const res = await client.fetch(objectUrl(key), {
    method: 'PUT',
    body: bytes as BodyInit,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
    },
  })
  if (!res.ok) {
    throw new Error(`R2 PUT ${key} failed: ${res.status} ${await safeText(res)}`)
  }
}

async function deleteObject(key: string): Promise<void> {
  const { client } = getR2()
  const res = await client.fetch(objectUrl(key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 DELETE ${key} failed: ${res.status} ${await safeText(res)}`)
  }
}

interface ListResult {
  keys: string[]
  truncated: boolean
  cursor?: string
}

async function listObjects(
  prefix: string,
  cursor?: string,
): Promise<ListResult> {
  const { client, endpoint, bucket } = getR2()
  const url = new URL(`${endpoint}/${bucket}`)
  url.searchParams.set('list-type', '2')
  url.searchParams.set('prefix', prefix)
  if (cursor) url.searchParams.set('continuation-token', cursor)

  const res = await client.fetch(url.toString())
  if (!res.ok) {
    throw new Error(`R2 LIST ${prefix} failed: ${res.status} ${await safeText(res)}`)
  }
  const xml = await res.text()
  const keys = Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g)).map((m) =>
    decodeXmlEntities(m[1]),
  )
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
  const tokenMatch = xml.match(
    /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/,
  )
  return {
    keys,
    truncated,
    cursor: tokenMatch ? decodeXmlEntities(tokenMatch[1]) : undefined,
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300)
  } catch {
    return ''
  }
}

// -----------------------------------------------------------------------------
// Per-article metadata + generated images
// -----------------------------------------------------------------------------

function metadataKey(company: string, articleNo: string): string {
  return `${company}/product-media/metadata/${articleNo}.json`
}

function imageKey(company: string, articleNo: string, imageId: string): string {
  return `${company}/product-media/images/${articleNo}/${imageId}.png`
}

export async function getMetadata(
  company: string,
  articleNo: string,
): Promise<ArticleMediaMetadata | null> {
  const res = await getObject(metadataKey(company, articleNo))
  if (!res) return null
  try {
    return (await res.json()) as ArticleMediaMetadata
  } catch {
    return null
  }
}

export async function saveMetadata(
  company: string,
  metadata: ArticleMediaMetadata,
): Promise<void> {
  await putObject(
    metadataKey(company, metadata.articleNo),
    JSON.stringify(metadata, null, 2),
    'application/json',
  )
}

export async function appendGeneratedImage(
  company: string,
  articleNo: string,
  image: GeneratedImage,
  pngBytes: ArrayBuffer,
): Promise<ArticleMediaMetadata> {
  await putObject(imageKey(company, articleNo, image.id), pngBytes, 'image/png')

  const existing = await getMetadata(company, articleNo)
  const metadata: ArticleMediaMetadata = existing ?? {
    articleNo,
    updatedAt: new Date().toISOString(),
    generated: [],
  }
  metadata.generated.unshift(image)
  metadata.updatedAt = new Date().toISOString()

  await saveMetadata(company, metadata)
  return metadata
}

/**
 * Read a generated image. Returns the raw fetch Response so callers can
 * stream it back to the client and read content-type from headers.
 */
export async function readImage(
  company: string,
  articleNo: string,
  imageId: string,
): Promise<Response | null> {
  return getObject(imageKey(company, articleNo, imageId))
}

export async function listAllMetadata(
  company: string,
): Promise<ArticleMediaMetadata[]> {
  const prefix = `${company}/product-media/metadata/`
  const results: ArticleMediaMetadata[] = []
  let cursor: string | undefined
  do {
    const page = await listObjects(prefix, cursor)
    for (const key of page.keys) {
      const res = await getObject(key)
      if (!res) continue
      try {
        results.push((await res.json()) as ArticleMediaMetadata)
      } catch {
        // skip corrupt entries
      }
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return results
}

/**
 * Cheap per-article count: list image keys and group by articleNo.
 */
export async function listGeneratedCountsByArticle(
  company: string,
): Promise<Map<string, number>> {
  const prefix = `${company}/product-media/images/`
  const counts = new Map<string, number>()
  let cursor: string | undefined
  do {
    const page = await listObjects(prefix, cursor)
    for (const key of page.keys) {
      // Key: {company}/product-media/images/{articleNo}/{imageId}.png
      const rest = key.slice(prefix.length)
      const slash = rest.indexOf('/')
      if (slash === -1) continue
      const articleNo = rest.slice(0, slash)
      counts.set(articleNo, (counts.get(articleNo) ?? 0) + 1)
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return counts
}

// -----------------------------------------------------------------------------
// Global references (per-company reusable reference images for AI generation)
// -----------------------------------------------------------------------------

function globalRefsMetadataKey(company: string): string {
  return `${company}/product-media/global-references.json`
}

function globalRefBinaryKey(
  company: string,
  id: string,
  contentType: string,
): string {
  const ext = contentType.includes('jpeg')
    ? 'jpg'
    : contentType.includes('webp')
      ? 'webp'
      : 'png'
  return `${company}/product-media/global-references/${id}.${ext}`
}

async function findGlobalRefBinaryKey(
  company: string,
  id: string,
): Promise<string | null> {
  const prefix = `${company}/product-media/global-references/${id}.`
  const page = await listObjects(prefix)
  return page.keys[0] ?? null
}

export async function getGlobalReferencesMetadata(
  company: string,
): Promise<GlobalReferencesMetadata> {
  const res = await getObject(globalRefsMetadataKey(company))
  if (!res) {
    return { company, updatedAt: new Date().toISOString(), references: [] }
  }
  try {
    return (await res.json()) as GlobalReferencesMetadata
  } catch {
    return { company, updatedAt: new Date().toISOString(), references: [] }
  }
}

async function saveGlobalReferencesMetadata(
  company: string,
  metadata: GlobalReferencesMetadata,
): Promise<void> {
  await putObject(
    globalRefsMetadataKey(company),
    JSON.stringify(metadata, null, 2),
    'application/json',
  )
}

export async function addGlobalReference(
  company: string,
  reference: GlobalReference,
  bytes: ArrayBuffer,
): Promise<GlobalReferencesMetadata> {
  const key = globalRefBinaryKey(company, reference.id, reference.contentType)
  await putObject(key, bytes, reference.contentType)

  const metadata = await getGlobalReferencesMetadata(company)
  metadata.references.unshift(reference)
  metadata.updatedAt = new Date().toISOString()
  await saveGlobalReferencesMetadata(company, metadata)
  return metadata
}

export async function removeGlobalReference(
  company: string,
  id: string,
): Promise<GlobalReferencesMetadata> {
  const binaryKey = await findGlobalRefBinaryKey(company, id)
  if (binaryKey) {
    await deleteObject(binaryKey)
  }
  const metadata = await getGlobalReferencesMetadata(company)
  metadata.references = metadata.references.filter((r) => r.id !== id)
  metadata.updatedAt = new Date().toISOString()
  await saveGlobalReferencesMetadata(company, metadata)
  return metadata
}

export async function readGlobalReference(
  company: string,
  id: string,
): Promise<Response | null> {
  const key = await findGlobalRefBinaryKey(company, id)
  if (!key) return null
  return getObject(key)
}
