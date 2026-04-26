'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { Save, Loader2, RefreshCw, AlertCircle, GripVertical, Plus, X, Search, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SortableProductCard } from './sortable-product-card'
import type { ProductRankItem, ProductRankingResponse } from '@/types/product-ranking'

interface ProductRankingPageViewProps {
  companyId: string
}

export function ProductRankingPageView({ companyId }: ProductRankingPageViewProps) {
  const [rankedItems, setRankedItems] = useState<ProductRankItem[]>([])
  const [unrankedItems, setUnrankedItems] = useState<ProductRankItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [showSyncDialog, setShowSyncDialog] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fetchData = useCallback(async (force = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        company: companyId,
        ...(force && { force: 'true' }),
      })
      const response = await fetch(`/api/product-ranking?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Kunde inte hämta produktranking')
      }

      const result: ProductRankingResponse = await response.json()
      setRankedItems(result.data.ranked)
      setUnrankedItems(result.data.unranked)
      setCachedAt(result.cachedAt)
      setIsDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSyncResult(null)

    try {
      const totalRanked = rankedItems.length
      const ranks = rankedItems.map((item, index) => ({
        id: item.displayItemId,
        defaultRank: totalRanked - index,
      }))

      const response = await fetch('/api/product-ranking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranks }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Kunde inte spara')
      }

      setIsDirty(false)
      await fetchData(true)
      setShowSyncDialog(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setShowSyncDialog(false)
    setError(null)
    setSyncResult(null)

    try {
      const response = await fetch('/api/product-ranking', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Kunde inte indexera')
      }

      const result = await response.json()
      const syncInfo = result.synced
        ?.map((s: { index: string; updated: number }) => `${s.index}: ${s.updated} dokument`)
        .join(', ')
      setSyncResult(`Indexering klar! ${syncInfo}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte indexera till Elasticsearch')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    setRankedItems((items) => {
      const oldIndex = items.findIndex((i) => i.displayItemId === String(active.id))
      const newIndex = items.findIndex((i) => i.displayItemId === String(over.id))
      if (oldIndex === -1 || newIndex === -1) return items
      setIsDirty(true)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  const handleAddProduct = (item: ProductRankItem) => {
    setUnrankedItems((prev) => prev.filter((i) => i.displayItemId !== item.displayItemId))
    setRankedItems((prev) => [...prev, item])
    setIsDirty(true)
  }

  const handleRemoveProduct = (item: ProductRankItem) => {
    setRankedItems((prev) => prev.filter((i) => i.displayItemId !== item.displayItemId))
    setUnrankedItems((prev) => [...prev, item].sort((a, b) => a.displayName.localeCompare(b.displayName, 'sv')))
    setIsDirty(true)
  }

  const filteredUnranked = useMemo(() => {
    if (!addSearch.trim()) return unrankedItems.slice(0, 50)
    const search = addSearch.toLowerCase()
    return unrankedItems
      .filter((i) =>
        i.displayName.toLowerCase().includes(search) ||
        i.productName.toLowerCase().includes(search)
      )
      .slice(0, 50)
  }, [unrankedItems, addSearch])

  const activeItem = activeId
    ? rankedItems.find((i) => i.displayItemId === activeId)
    : null

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Produktranking</h2>
          <p className="text-sm text-muted-foreground">
            Dra och släpp för att ändra ordningen. Högst upp = visas först i sökresultaten.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-sm text-amber-600">Osparade ändringar</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isSaving}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Uppdatera
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Spara
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

      {syncResult && (
        <Alert>
          <Upload className="h-4 w-4" />
          <AlertDescription>{syncResult}</AlertDescription>
        </Alert>
      )}

      {isSyncing && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Indexerar till Elasticsearch...</AlertDescription>
        </Alert>
      )}

      {/* Header for ranked list + add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Rankade produkter ({rankedItems.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setShowAddPanel(!showAddPanel); setAddSearch('') }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Lägg till produkt
        </Button>
      </div>

      {/* Add product panel - shown right below the button */}
      {showAddPanel && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Lägg till produkt</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAddPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Sök bland orankade produkter..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filteredUnranked.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {addSearch ? 'Inga produkter hittades' : 'Inga orankade produkter'}
              </p>
            ) : (
              filteredUnranked.map((item) => (
                <button
                  key={item.displayItemId}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent transition-colors"
                  onClick={() => handleAddProduct(item)}
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">N/A</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{item.displayName}</div>
                    {item.productName !== item.displayName && (
                      <div className="truncate text-xs text-muted-foreground">{item.productName}</div>
                    )}
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sortable ranked list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div>
          <SortableContext
            items={rankedItems.map((i) => i.displayItemId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {rankedItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Inga rankade produkter ännu. Klicka &quot;Lägg till produkt&quot; för att börja.
                </div>
              ) : (
                rankedItems.map((item, index) => (
                  <SortableProductCard
                    key={item.displayItemId}
                    item={item}
                    index={index}
                    showRank
                    onRemove={() => handleRemoveProduct(item)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-lg ring-2 ring-primary">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                {activeItem.imageUrl ? (
                  <img
                    src={activeItem.imageUrl}
                    alt={activeItem.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    N/A
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{activeItem.displayName}</div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AlertDialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ranking sparad!</AlertDialogTitle>
            <AlertDialogDescription>
              Rankingen har sparats till databasen. Vill du även uppdatera sökningen på hemsidan?
              Detta indexerar ändringarna till Elasticsearch (de, en, sv).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Inte nu</AlertDialogCancel>
            <AlertDialogAction onClick={handleSync}>
              Ja, indexera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
