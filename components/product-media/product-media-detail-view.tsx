'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, AlertCircle, Sparkles, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { GenerateImageModal } from './generate-image-modal'
import type {
  GeneratedImage,
  GlobalReference,
  GlobalReferencesListResponse,
  ProductMediaDetail,
} from '@/types/product-media'

interface ProductMediaDetailViewProps {
  companyId: string
  articleNo: string
}

export function ProductMediaDetailView({ companyId, articleNo }: ProductMediaDetailViewProps) {
  const [detail, setDetail] = useState<ProductMediaDetail | null>(null)
  const [globalReferences, setGlobalReferences] = useState<GlobalReference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [detailRes, globalsRes] = await Promise.all([
        fetch(
          `/api/product-media/${encodeURIComponent(articleNo)}?company=${encodeURIComponent(companyId)}`,
        ),
        fetch(
          `/api/product-media/global-references?company=${encodeURIComponent(companyId)}`,
        ),
      ])

      if (!detailRes.ok) {
        const data = (await detailRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `Kunde inte hämta produkt (${detailRes.status})`)
      }
      setDetail((await detailRes.json()) as ProductMediaDetail)

      if (globalsRes.ok) {
        const g = (await globalsRes.json()) as GlobalReferencesListResponse
        setGlobalReferences(g.references)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
    } finally {
      setIsLoading(false)
    }
  }, [companyId, articleNo])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleGenerated = (image: GeneratedImage) => {
    setDetail((prev) =>
      prev ? { ...prev, generated: [image, ...prev.generated] } : prev,
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-48" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link
          href={`/${companyId}/product-media`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Produkt hittades inte'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const availableReferences = [
    ...detail.images.map((url, i) => ({
      url,
      label: `Original ${i + 1}`,
      kind: 'original' as const,
    })),
    ...detail.generated.map((g, i) => ({
      url: g.url,
      label: `Genererad ${i + 1}`,
      kind: 'generated' as const,
    })),
    ...globalReferences.map((g) => ({
      url: g.url,
      label: g.label,
      kind: 'global' as const,
    })),
  ]

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/${companyId}/product-media`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Tillbaka till listan
      </Link>

      {/* Product info */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{detail.displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {detail.productNumber && (
              <>
                <span>{detail.productNumber}</span>
                <span>·</span>
              </>
            )}
            <span>{detail.productName}</span>
            <span>·</span>
            <span className="text-xs">Display #{detail.articleNo}</span>
            <span>·</span>
            <Badge variant="outline" className="text-xs">
              {detail.status}
            </Badge>
          </div>
          {detail.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {detail.categories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <Button onClick={() => setModalOpen(true)} size="lg">
          <Sparkles className="mr-2 h-4 w-4" />
          Generera ny bild
        </Button>
      </div>

      {/* Original images */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            Originalbilder ({detail.images.length})
          </h2>
        </div>
        {detail.images.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Inga originalbilder på produkten.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {detail.images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setLightboxImage(url)}
                className="h-48 w-48 shrink-0 overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${detail.displayName} ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Generated images */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Genererade bilder ({detail.generated.length})
          </h2>
        </div>
        {detail.generated.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Inga genererade bilder än. Klicka &quot;Generera ny bild&quot; för att komma igång.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {detail.generated.map((img) => (
              <GeneratedImageCard
                key={img.id}
                image={img}
                onClick={() => setLightboxImage(img.url)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4',
            'animate-in fade-in-0',
          )}
          onClick={() => setLightboxImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImage}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}

      {/* Modal */}
      <GenerateImageModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        articleNo={articleNo}
        company={companyId}
        availableReferences={availableReferences}
        onGenerated={handleGenerated}
      />
    </div>
  )
}

function GeneratedImageCard({
  image,
  onClick,
}: {
  image: GeneratedImage
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-lg border bg-card text-left transition-all hover:border-primary/50"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="space-y-1 p-2">
        <p className="line-clamp-2 text-xs text-foreground">{image.prompt}</p>
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="text-[9px]">
            {image.quality}
          </Badge>
          <Badge variant="outline" className="text-[9px]">
            {image.size}
          </Badge>
          {image.thinking && (
            <Badge variant="outline" className="text-[9px]">
              tänk:{image.thinking}
            </Badge>
          )}
          <span>·</span>
          <span>{new Date(image.createdAt).toLocaleDateString('sv-SE')}</span>
        </div>
      </div>
    </button>
  )
}
