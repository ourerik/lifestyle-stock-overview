'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Images, RefreshCw, Search, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ProductMediaCard } from './product-media-card'
import { GlobalReferencesSheet } from './global-references-sheet'
import type {
  ProductMediaItem,
  ProductMediaListResponse,
} from '@/types/product-media'

interface ProductMediaListViewProps {
  companyId: string
}

export function ProductMediaListView({ companyId }: ProductMediaListViewProps) {
  const router = useRouter()
  const [products, setProducts] = useState<ProductMediaItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [globalRefsOpen, setGlobalRefsOpen] = useState(false)

  const fetchData = useCallback(
    async (force = false) => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ company: companyId })
        if (force) params.set('force', 'true')
        const res = await fetch(`/api/product-media?${params}`)
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error || 'Kunde inte hämta produkter')
        }
        const json = (await res.json()) as ProductMediaListResponse
        setProducts(json.products)
        setCategories(json.categories)
        setCachedAt(json.cachedAt)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Okänt fel')
      } finally {
        setIsLoading(false)
      }
    },
    [companyId],
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return products.filter((p) => {
      if (selectedCategories.size > 0) {
        const hasAny = p.categories.some((c) => selectedCategories.has(c))
        if (!hasAny) return false
      }
      if (s) {
        const haystack = [p.displayName, p.productName, p.articleNo]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(s)) return false
      }
      return true
    })
  }, [products, search, selectedCategories])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Experiment – AI-bilder</h2>
          <p className="text-sm text-muted-foreground">
            Klicka på en produkt för att generera nya bilder med AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGlobalRefsOpen(true)}
          >
            <Images className="mr-1.5 h-4 w-4" />
            Globala referenser
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchData(true)}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Uppdatera
          </Button>
        </div>
      </div>

      {cachedAt && (
        <p className="text-xs text-muted-foreground">
          Senast hämtad: {new Date(cachedAt).toLocaleString('sv-SE')}
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search + filters */}
      <div className="space-y-3 rounded-lg border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sök produkt, artikelnummer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
              onClick={() => setSearch('')}
              aria-label="Rensa sökning"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const active = selectedCategories.has(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input hover:bg-accent',
                  )}
                >
                  {cat}
                </button>
              )
            })}
            {selectedCategories.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategories(new Set())}
                className="rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                Rensa filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} av {products.length} produkter
        </p>
        {products.filter((p) => p.generatedCount > 0).length > 0 && (
          <Badge variant="secondary">
            {products.reduce((sum, p) => sum + p.generatedCount, 0)} genererade bilder totalt
          </Badge>
        )}
      </div>

      <GlobalReferencesSheet
        open={globalRefsOpen}
        onOpenChange={setGlobalRefsOpen}
        company={companyId}
      />

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Inga produkter matchar filtren.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <ProductMediaCard
              key={item.displayItemId}
              item={item}
              onClick={() =>
                router.push(
                  `/${companyId}/product-media/${encodeURIComponent(item.articleNo)}`,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
