'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Package, AlertTriangle, TrendingUp, Search, RefreshCw, ChevronDown } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InventoryTable } from './inventory-table'
import { ProductDetailSheet } from './product-detail-sheet'
import type { InventoryData, ProductStatus, AggregatedProduct } from '@/types/inventory'
import type { CompanyId } from '@/config/companies'
import { formatCurrency } from '@/types/fifo'

interface InventoryViewProps {
  data: InventoryData | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  onRefresh: () => void
  showZettle?: boolean
  cachedAt: Date | null
  fromCache: boolean
  companyId: Exclude<CompanyId, 'all'>
}

export function InventoryView({
  data,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  showZettle = false,
  cachedAt,
  fromCache,
  companyId,
}: InventoryViewProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all')
  const [stockFilter, setStockFilter] = useState<'in-stock' | 'all'>('in-stock')

  // Get product from URL
  const productParam = searchParams.get('product')

  // Find product by productNumber from URL
  const selectedProduct = useMemo(() => {
    if (!productParam || !data) return null
    return data.products.find(p => p.productNumber === productParam) || null
  }, [productParam, data])

  // Update URL when selecting/deselecting product
  const updateProductParam = useCallback((product: AggregatedProduct | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (product) {
      params.set('product', product.productNumber)
    } else {
      params.delete('product')
      params.delete('tab')
      params.delete('variant')
      params.delete('size')
      params.delete('days')
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!data) return []

    return data.products.filter(product => {
      // Stock filter - exclude products with 0 stock and no incoming
      if (stockFilter === 'in-stock') {
        const hasStock =
          product.totalQuantity > 0 ||
          product.totalZettleQuantity > 0 ||
          product.totalIncoming > 0
        if (!hasStock) return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          product.productName.toLowerCase().includes(query) ||
          product.productNumber.toLowerCase().includes(query) ||
          product.variants.some(v => v.variantName.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }

      // Folder filter
      if (selectedFolder !== 'all' && product.folder !== selectedFolder) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all' && !product.status.includes(statusFilter)) {
        return false
      }

      return true
    })
  }, [data, searchQuery, selectedFolder, statusFilter, stockFilter])

  // Products filtered only by stock filter (for folder counts)
  const filteredByStockProducts = useMemo(() => {
    if (!data) return []

    return data.products.filter(product => {
      if (stockFilter === 'in-stock') {
        return (
          product.totalQuantity > 0 ||
          product.totalZettleQuantity > 0 ||
          product.totalIncoming > 0
        )
      }
      return true
    })
  }, [data, stockFilter])

  // Get FIFO summary values and location stats
  const locationStats = useMemo(() => {
    if (!data) {
      return {
        warehouse: { quantity: 0, products: 0, value: null as number | null },
        store: { quantity: 0, products: 0, value: null as number | null },
        total: { value: null as number | null },
      }
    }

    // Count products with warehouse/store stock
    let warehouseProducts = 0
    let storeProducts = 0
    for (const product of data.products) {
      if (product.totalQuantity > 0) warehouseProducts++
      if (product.totalZettleQuantity > 0) storeProducts++
    }

    const fifoSummary = data.fifoSummary
    const warehouseValue = fifoSummary?.totalValueByLocation?.warehouse ?? null
    const storeValue = fifoSummary?.totalValueByLocation?.store ?? null
    const totalValue = fifoSummary?.totalValue ?? null

    return {
      warehouse: {
        quantity: data.summary.totalQuantity,
        products: warehouseProducts,
        value: warehouseValue,
      },
      store: {
        quantity: data.summary.totalZettleQuantity,
        products: storeProducts,
        value: storeValue,
      },
      total: {
        value: totalValue,
      },
    }
  }, [data])

  // Calculate folder counts and sort by count descending
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>()

    for (const product of filteredByStockProducts) {
      if (product.folder) {
        counts.set(product.folder, (counts.get(product.folder) || 0) + 1)
      }
    }

    return Array.from(counts.entries())
      .map(([folder, count]) => ({ folder, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredByStockProducts])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Kunde inte hämta lagerdata</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Försök igen
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <LocationSummaryCard
          title="Lager"
          quantity={locationStats.warehouse.quantity}
          products={locationStats.warehouse.products}
          value={locationStats.warehouse.value}
          isLoading={isLoading}
        />
        {showZettle && (
          <LocationSummaryCard
            title="Butik"
            quantity={locationStats.store.quantity}
            products={locationStats.store.products}
            value={locationStats.store.value}
            isLoading={isLoading}
          />
        )}
        <SummaryCard
          title="Lågt lager"
          value={data?.summary.lowStockCount}
          subtitle="produkter"
          icon={AlertTriangle}
          isLoading={isLoading}
          variant="warning"
        />
        <SummaryCard
          title="Inkommande"
          value={data?.summary.incomingCount}
          subtitle="produkter med leverans"
          icon={TrendingUp}
          isLoading={isLoading}
          variant="info"
        />
      </div>

      {/* Info alert */}
      <Alert variant="info">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              <span className="font-medium">Datakälla:</span>{' '}
              Ongoing{showZettle ? ' + Zettle' : ''}
            </span>
            {data?.summary.lastUpdated && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">Lagerdata från:</span>{' '}
                  {new Date(`${data.summary.lastUpdated}T01:00`).toLocaleString('sv-SE', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            {cachedAt
              ? `${fromCache ? 'Cache' : 'Ny'} ${cachedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
              : 'Uppdatera'}
          </Button>
        </div>
      </Alert>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök produkt..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-4 flex-wrap items-center">
          {/* Category filter */}
          {data && folderCounts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {selectedFolder === 'all'
                    ? `Kategori (${filteredByStockProducts.length})`
                    : `${selectedFolder} (${folderCounts.find(f => f.folder === selectedFolder)?.count || 0})`}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => setSelectedFolder('all')}
                  className={selectedFolder === 'all' ? 'bg-accent' : ''}
                >
                  Alla ({filteredByStockProducts.length})
                </DropdownMenuItem>
                {folderCounts.map(({ folder, count }) => (
                  <DropdownMenuItem
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={selectedFolder === folder ? 'bg-accent' : ''}
                  >
                    {folder} ({count})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Stock filter */}
          <Tabs value={stockFilter} onValueChange={(v) => setStockFilter(v as 'in-stock' | 'all')}>
            <TabsList>
              <TabsTrigger value="in-stock">I lager</TabsTrigger>
              <TabsTrigger value="all">Alla</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Status filter */}
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProductStatus | 'all')}>
            <TabsList>
              <TabsTrigger value="all">Alla</TabsTrigger>
              <TabsTrigger value="low">Lågt lager</TabsTrigger>
              <TabsTrigger value="incoming">Inkommande</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Products table */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <InventoryTable
            products={filteredProducts}
            showZettle={showZettle}
            onSelectProduct={updateProductParam}
          />
        </div>
      )}

      {/* Product detail drawer */}
      <ProductDetailSheet
        product={selectedProduct}
        open={selectedProduct !== null}
        onOpenChange={(open) => !open && updateProductParam(null)}
        showZettle={showZettle}
        stockFilter={stockFilter}
        companyId={companyId}
      />

      {/* Results count */}
      {!isLoading && data && (
        <div className="text-sm text-muted-foreground text-center">
          Visar {filteredProducts.length} av {data.products.length} produkter
        </div>
      )}
    </div>
  )
}

interface LocationSummaryCardProps {
  title: string
  quantity: number
  products: number
  value: number | null
  isLoading: boolean
}

function LocationSummaryCard({
  title,
  quantity,
  products,
  value,
  isLoading,
}: LocationSummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold">{quantity.toLocaleString('sv-SE')} st</p>
                <p className="text-xs text-muted-foreground">
                  {products} produkter
                  {value != null && (
                    <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                      · {formatCurrency(value)}
                    </span>
                  )}
                </p>
              </>
            )}
          </div>
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

interface SummaryCardProps {
  title: string
  value: number | undefined | null
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  isLoading: boolean
  variant?: 'default' | 'warning' | 'info'
  formatAsCurrency?: boolean
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  isLoading,
  variant = 'default',
  formatAsCurrency = false,
}: SummaryCardProps) {
  const iconColorClass =
    variant === 'warning'
      ? 'text-amber-500'
      : variant === 'info'
        ? 'text-blue-500'
        : 'text-muted-foreground'

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <p className="text-2xl font-bold">
                {value != null
                  ? formatAsCurrency
                    ? formatCurrency(value)
                    : value.toLocaleString('sv-SE')
                  : '-'}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <Icon className={`h-8 w-8 ${iconColorClass}`} />
        </div>
      </CardContent>
    </Card>
  )
}
