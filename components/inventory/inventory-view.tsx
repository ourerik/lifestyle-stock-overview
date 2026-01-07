'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { Package, AlertTriangle, RefreshCw, ChevronDown, FolderOpen, Eye } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KpiCard } from '@/components/ui/kpi-card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { TableToolbar } from '@/components/ui/table-toolbar'
import { useColumnVisibility, type ColumnConfig } from '@/hooks/use-column-visibility'
import { StatusBadges } from './status-badge'
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

  // Build columns dynamically based on showZettle
  const columns = useMemo((): Column<AggregatedProduct>[] => {
    const baseColumns: Column<AggregatedProduct>[] = [
      {
        id: 'productName',
        label: 'Produkt',
        accessor: (row) => (
          <div className="flex items-center gap-3">
            {row.image ? (
              <Image
                src={row.image}
                alt={row.productName}
                width={40}
                height={40}
                className="rounded object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                N/A
              </div>
            )}
            <div>
              <div className="font-medium">{row.productName}</div>
              <div className="text-xs text-muted-foreground">{row.productNumber}</div>
            </div>
          </div>
        ),
        sortable: true,
        width: 'min-w-[200px]',
      },
      {
        id: 'totalQuantity',
        label: 'Centrallager',
        accessor: 'totalQuantity',
        sortable: true,
        align: 'right',
        format: 'number',
        width: 'w-24',
      },
    ]

    // Add Butik column if showZettle is true
    if (showZettle) {
      baseColumns.push({
        id: 'totalZettleQuantity',
        label: 'Butik',
        accessor: 'totalZettleQuantity',
        sortable: true,
        align: 'right',
        format: 'number',
        width: 'w-24',
      })
    }

    // Add remaining columns
    baseColumns.push(
      {
        id: 'totalIncoming',
        label: 'Inkommande',
        accessor: 'totalIncoming',
        sortable: true,
        align: 'right',
        width: 'w-24',
        renderCell: (value) =>
          value > 0 ? (
            <span className="text-blue-600 dark:text-blue-400 font-medium">+{value}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: 'fifoValue',
        label: 'Lagervärde',
        accessor: 'fifoValue',
        sortable: true,
        align: 'right',
        width: 'w-28',
        renderCell: (value) =>
          value != null ? (
            <span className="font-medium">{formatCurrency(value)}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: 'fifoCost',
        label: 'Kr/st',
        accessor: 'fifoCost',
        sortable: true,
        align: 'right',
        width: 'w-24',
        defaultVisible: false,
        renderCell: (value) =>
          value != null ? (
            <span className="text-muted-foreground">{formatCurrency(value)}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: 'status',
        label: 'Status',
        accessor: (row) => <StatusBadges statuses={row.status} />,
        sortable: false,
        width: 'w-32',
      }
    )

    return baseColumns
  }, [showZettle])

  // Column configs for visibility hook
  const columnConfigs: ColumnConfig[] = useMemo(
    () =>
      columns.map((col) => ({
        id: col.id,
        label: col.label,
        defaultVisible: col.defaultVisible !== false,
      })),
    [columns]
  )

  // Column visibility
  const { visibleColumns, toggleColumn, resetToDefaults } = useColumnVisibility(
    'inventory-products',
    columnConfigs
  )

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
      {/* Info alert */}
      <Alert variant="info">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 text-sm">
            {/* Mobile: stacked, Desktop: inline */}
            <div className="sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <span>
                <span className="font-medium">Datakälla:</span>{' '}
                Ongoing{showZettle ? ' + Zettle' : ''}
              </span>
              {data?.summary.lastUpdated && (
                <>
                  <span className="hidden sm:inline text-muted-foreground">•</span>
                  <span className="block sm:inline text-muted-foreground mt-0.5 sm:mt-0">
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
          </div>
          {/* Mobile: icon only, Desktop: full button */}
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 shrink-0 sm:hidden"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="hidden sm:inline-flex gap-1.5 shrink-0"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            {cachedAt
              ? `${fromCache ? 'Cache' : 'Ny'} ${cachedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
              : 'Uppdatera'}
          </Button>
        </div>
      </Alert>

      {/* Summary cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:gap-4 md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:pb-0">
        <KpiCard
          title="Centrallager"
          value={locationStats.warehouse.quantity}
          suffix="st"
          format="number"
          subtitle={`${locationStats.warehouse.products} produkter${locationStats.warehouse.value != null ? ` · ${formatCurrency(locationStats.warehouse.value)}` : ''}`}
          loading={isLoading}
        />
        {showZettle && (
          <KpiCard
            title="Butik"
            value={locationStats.store.quantity}
            suffix="st"
            format="number"
            subtitle={`${locationStats.store.products} produkter${locationStats.store.value != null ? ` · ${formatCurrency(locationStats.store.value)}` : ''}`}
            loading={isLoading}
          />
        )}
        <KpiCard
          title="Lågt lager"
          value={data?.summary.lowStockCount ?? 0}
          suffix="st"
          format="number"
          subtitle="produkter"
          loading={isLoading}
        />
        <KpiCard
          title="Inkommande"
          value={data?.summary.incomingCount ?? 0}
          suffix="st"
          format="number"
          subtitle="produkter med leverans"
          loading={isLoading}
        />
      </div>

      {/* Toolbar */}
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Sök produkt..."
        columnConfigs={columnConfigs}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        onResetColumns={resetToDefaults}
        filters={
          <>
            {/* Category filter */}
            {data && folderCounts.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8">
                    <FolderOpen className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline truncate max-w-[120px]">
                      {selectedFolder === 'all' ? 'Alla kategorier' : selectedFolder}
                    </span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                  <DropdownMenuRadioGroup value={selectedFolder} onValueChange={setSelectedFolder}>
                    <DropdownMenuRadioItem value="all">
                      Alla kategorier ({filteredByStockProducts.length})
                    </DropdownMenuRadioItem>
                    {folderCounts.map(({ folder, count }) => (
                      <DropdownMenuRadioItem key={folder} value={folder}>
                        {folder} ({count})
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Stock filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  <Package className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">
                    {stockFilter === 'in-stock' ? 'I lager' : 'Alla'}
                  </span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={stockFilter} onValueChange={(v) => setStockFilter(v as 'in-stock' | 'all')}>
                  <DropdownMenuRadioItem value="in-stock">I lager</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="all">Alla</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  <Eye className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">
                    {statusFilter === 'all' ? 'Alla status' : statusFilter === 'low' ? 'Lågt lager' : 'Inkommande'}
                  </span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProductStatus | 'all')}>
                  <DropdownMenuRadioItem value="all">Alla status</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="low">Lågt lager</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="incoming">Inkommande</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Products table */}
      <DataTable<AggregatedProduct>
        data={filteredProducts}
        columns={columns}
        tableId="inventory-products"
        loading={isLoading}
        emptyMessage="Inga produkter hittades"
        onRowClick={updateProductParam}
        rowKey="productNumber"
        hideColumnSelector
        visibleColumns={visibleColumns}
        defaultSortField="totalQuantity"
        defaultSortOrder="desc"
        mobileFullBleed
      />

      {/* Product detail drawer */}
      <ProductDetailSheet
        product={selectedProduct}
        open={selectedProduct !== null}
        onOpenChange={(open) => !open && updateProductParam(null)}
        showZettle={showZettle}
        stockFilter={stockFilter}
        companyId={companyId}
      />
    </div>
  )
}

