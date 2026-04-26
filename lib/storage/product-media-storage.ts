import { getCloudflareContext } from '@opennextjs/cloudflare'
import type {
  ArticleMediaMetadata,
  GeneratedImage,
  GlobalReference,
  GlobalReferencesMetadata,
} from '@/types/product-media'

function bucket(): R2Bucket {
  const { env } = getCloudflareContext()
  if (!env.STORAGE) {
    throw new Error('STORAGE R2 binding is not configured')
  }
  return env.STORAGE
}

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
  const obj = await bucket().get(metadataKey(company, articleNo))
  if (!obj) return null
  const text = await obj.text()
  try {
    return JSON.parse(text) as ArticleMediaMetadata
  } catch {
    return null
  }
}

export async function saveMetadata(
  company: string,
  metadata: ArticleMediaMetadata,
): Promise<void> {
  await bucket().put(
    metadataKey(company, metadata.articleNo),
    JSON.stringify(metadata, null, 2),
    { httpMetadata: { contentType: 'application/json' } },
  )
}

export async function appendGeneratedImage(
  company: string,
  articleNo: string,
  image: GeneratedImage,
  pngBytes: ArrayBuffer,
): Promise<ArticleMediaMetadata> {
  await bucket().put(imageKey(company, articleNo, image.id), pngBytes, {
    httpMetadata: { contentType: 'image/png' },
  })

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

export async function readImage(
  company: string,
  articleNo: string,
  imageId: string,
): Promise<R2ObjectBody | null> {
  const obj = await bucket().get(imageKey(company, articleNo, imageId))
  return obj
}

export async function listAllMetadata(
  company: string,
): Promise<ArticleMediaMetadata[]> {
  const prefix = `${company}/product-media/metadata/`
  const listed = await bucket().list({ prefix })
  const results: ArticleMediaMetadata[] = []
  for (const obj of listed.objects) {
    const body = await bucket().get(obj.key)
    if (!body) continue
    try {
      results.push(JSON.parse(await body.text()) as ArticleMediaMetadata)
    } catch {
      // skip corrupt entries
    }
  }
  return results
}

/**
 * Cheap per-article count: one R2 list call, parse object keys to count.
 * Used by the listing endpoint to populate the "N generated" badge without
 * reading every metadata file (which would hit subrequest/CPU limits on
 * Cloudflare Workers when many articles have been generated for).
 */
export async function listGeneratedCountsByArticle(
  company: string,
): Promise<Map<string, number>> {
  const prefix = `${company}/product-media/images/`
  const counts = new Map<string, number>()
  let cursor: string | undefined
  do {
    const page = await bucket().list({ prefix, cursor, limit: 1000 })
    for (const obj of page.objects) {
      // Key: {company}/product-media/images/{articleNo}/{imageId}.png
      const rest = obj.key.slice(prefix.length)
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
  const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png'
  return `${company}/product-media/global-references/${id}.${ext}`
}

async function findGlobalRefBinaryKey(
  company: string,
  id: string,
): Promise<string | null> {
  const prefix = `${company}/product-media/global-references/${id}.`
  const listed = await bucket().list({ prefix })
  return listed.objects[0]?.key ?? null
}

export async function getGlobalReferencesMetadata(
  company: string,
): Promise<GlobalReferencesMetadata> {
  const obj = await bucket().get(globalRefsMetadataKey(company))
  if (!obj) {
    return { company, updatedAt: new Date().toISOString(), references: [] }
  }
  try {
    return JSON.parse(await obj.text()) as GlobalReferencesMetadata
  } catch {
    return { company, updatedAt: new Date().toISOString(), references: [] }
  }
}

async function saveGlobalReferencesMetadata(
  company: string,
  metadata: GlobalReferencesMetadata,
): Promise<void> {
  await bucket().put(
    globalRefsMetadataKey(company),
    JSON.stringify(metadata, null, 2),
    { httpMetadata: { contentType: 'application/json' } },
  )
}

export async function addGlobalReference(
  company: string,
  reference: GlobalReference,
  bytes: ArrayBuffer,
): Promise<GlobalReferencesMetadata> {
  const key = globalRefBinaryKey(company, reference.id, reference.contentType)
  await bucket().put(key, bytes, {
    httpMetadata: { contentType: reference.contentType },
  })

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
    await bucket().delete(binaryKey)
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
): Promise<R2ObjectBody | null> {
  const key = await findGlobalRefBinaryKey(company, id)
  if (!key) return null
  return bucket().get(key)
}
