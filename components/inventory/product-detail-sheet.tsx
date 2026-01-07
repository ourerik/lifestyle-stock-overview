'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  ResponsiveSheet,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/responsive-sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { TableToolbar } from '@/components/ui/table-toolbar'
import { KpiCard } from '@/components/ui/kpi-card'
import { useColumnVisibility, type ColumnConfig } from '@/hooks/use-column-visibility'
import { StatusBadges } from './status-badge'
import { StockHistoryChart } from './stock-history-chart'
import { PurchaseHistoryDialog } from './purchase-history-dialog'
import { InventoryVariantTable } from './inventory-variant-table'
import type { AggregatedProduct } from '@/types/inventory'
import type { CompanyId } from '@/config/companies'
import type { FifoProductValuation } from '@/types/fifo'
import type { ProductPurchaseHistory } from '@/types/purchase-history'
import { formatCurrency, formatPeriod, getAgeColorClass } from '@/types/fifo'

interface ProductDetailSheetProps {
  product: AggregatedProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
  showZettle?: boolean
  stockFilter?: 'in-stock' | 'all'
  companyId: Exclude<CompanyId, 'all'>
}

export function ProductDetailSheet({
  product,
  open,
  onOpenChange,
  showZettle = false,
  stockFilter = 'in-stock',
  companyId,
}: ProductDetailSheetProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [fifoData, setFifoData] = useState<FifoProductValuation | null>(null)
  const [fifoLoading, setFifoLoading] = useState(false)
  const [purchaseHistory, setPurchaseHistory] = useState<ProductPurchaseHistory | null>(null)
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedVariantForHistory, setSelectedVariantForHistory] = useState<{
    variantId: number
    variantName: string
  } | null>(null)
  const [variantSearch, setVariantSearch] = useState('')

  // Column configs for variant table
  const variantColumnConfigs: ColumnConfig[] = useMemo(() => [
    { id: 'variant', label: 'Variant', defaultVisible: true },
    { id: 'quantity', label: 'Lager', defaultVisible: true },
    ...(showZettle ? [{ id: 'zettleQuantity', label: 'Butik', defaultVisible: true }] : []),
    { id: 'incoming', label: 'Inkommande', defaultVisible: true },
    { id: 'value', label: 'Värde', defaultVisible: true },
    { id: 'age', label: 'I lager', defaultVisible: true },
    { id: 'history', label: 'Historik', defaultVisible: true },
  ], [showZettle])

  const { visibleColumns, toggleColumn, resetToDefaults } = useColumnVisibility(
    'inventory-variant-detail',
    variantColumnConfigs
  )

  // Fetch FIFO valuation data when sheet opens
  useEffect(() => {
    if (!open || !product) {
      setFifoData(null)
      return
    }

    const fetchFifoData = async () => {
      setFifoLoading(true)
      try {
        const res = await fetch(
          `/api/inventory/valuation?company=${companyId}&productNumber=${product.productNumber}`
        )
        if (res.ok) {
          const json = await res.json()
          // Find this product in the response
          const productValuation = json.data?.products?.find(
            (p: FifoProductValuation) => p.productNumber === product.productNumber
          )
          setFifoData(productValuation || null)
        }
      } catch (error) {
        console.error('Failed to fetch FIFO data:', error)
      } finally {
        setFifoLoading(false)
      }
    }

    fetchFifoData()
  }, [open, product, companyId])

  // Fetch purchase history data when sheet opens
  useEffect(() => {
    if (!open || !product) {
      setPurchaseHistory(null)
      return
    }

    const fetchPurchaseHistory = async () => {
      setPurchaseHistoryLoading(true)
      try {
        const res = await fetch(
          `/api/inventory/purchase-history?company=${companyId}&productNumber=${encodeURIComponent(product.productNumber)}`
        )
        if (res.ok) {
          const json = await res.json()
          setPurchaseHistory(json.data || null)
        }
      } catch (error) {
        console.error('Failed to fetch purchase history:', error)
      } finally {
        setPurchaseHistoryLoading(false)
      }
    }

    fetchPurchaseHistory()
  }, [open, product, companyId])

  // Get oldest purchase date across all sizes in the product
  const getProductOldestDate = useCallback((): string | null => {
    if (!fifoData) return null
    let oldest: string | null = null
    for (const variant of fifoData.variants) {
      for (const size of variant.sizes) {
        if (size.oldestPurchaseDate && (!oldest || size.oldestPurchaseDate < oldest)) {
          oldest = size.oldestPurchaseDate
        }
      }
    }
    return oldest
  }, [fifoData])

  // Get tab from URL, default to 'variants'
  const currentTab = searchParams.get('tab') || 'variants'

  // Update URL when changing tab
  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'variants') {
      params.delete('tab')
      // Clear history filters when switching to variants
      params.delete('variant')
      params.delete('size')
      params.delete('days')
    } else {
      params.set('tab', value)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  // Filter variants based on stock filter and search
  const filteredVariants = useMemo(() => {
    if (!product) return []

    let variants = product.variants

    // Stock filter
    if (stockFilter === 'in-stock') {
      variants = variants.filter(variant =>
        variant.totalQuantity > 0 ||
        variant.zettleQuantity > 0 ||
        variant.totalIncoming > 0
      )
    }

    // Search filter
    if (variantSearch) {
      const query = variantSearch.toLowerCase()
      variants = variants.filter(v =>
        v.variantName.toLowerCase().includes(query) ||
        v.variantNumber.toLowerCase().includes(query)
      )
    }

    return variants
  }, [product, stockFilter, variantSearch])

  if (!product) return null

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      desktopClassName="sm:!max-w-4xl"
    >
      <SheetHeader>
          <div className="flex items-start gap-4">
            {product.image ? (
              <button
                type="button"
                onClick={() => setPreviewImage(product.image!)}
                className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg"
              >
                <Image
                  src={product.image}
                  alt={product.productName}
                  width={80}
                  height={80}
                  className="rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                />
              </button>
            ) : (
              <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                N/A
              </div>
            )}
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left">{product.productName}</SheetTitle>
              <p className="text-sm text-muted-foreground">{product.productNumber}</p>
              <div className="mt-2">
                <StatusBadges statuses={product.status} />
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-4 md:px-6 pb-6">
          {/* Tabs - navigation above KPIs */}
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <TabsList>
              <TabsTrigger value="variants">Varianter i lager</TabsTrigger>
              <TabsTrigger value="history">Historik</TabsTrigger>
            </TabsList>

            <TabsContent value="variants" className="mt-4 space-y-4">
              {/* Summary KPI cards - horizontal scroll on mobile, grid on desktop */}
              <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible md:pb-0">
                <KpiCard
                  title="Lager"
                  value={product.totalQuantity}
                  suffix="st"
                  format="number"
                  size="sm"
                />
                {showZettle && (
                  <KpiCard
                    title="Butik"
                    value={product.totalZettleQuantity}
                    suffix="st"
                    format="number"
                    size="sm"
                  />
                )}
                <KpiCard
                  title="Inkommande"
                  value={product.totalIncoming > 0 ? product.totalIncoming : '-'}
                  suffix={product.totalIncoming > 0 ? 'st' : undefined}
                  format="number"
                  size="sm"
                />
                <KpiCard
                  title="Lagervärde"
                  value={fifoData?.totalValue ?? '-'}
                  format={fifoData ? 'currency' : 'none'}
                  loading={fifoLoading}
                  subtitle={showZettle && fifoData ? (() => {
                    let warehouseVal = 0
                    let storeVal = 0
                    for (const v of fifoData.variants) {
                      for (const s of v.sizes) {
                        warehouseVal += s.valueByLocation?.warehouse ?? 0
                        storeVal += s.valueByLocation?.store ?? 0
                      }
                    }
                    if (warehouseVal > 0 || storeVal > 0) {
                      return `${formatCurrency(warehouseVal)} / ${formatCurrency(storeVal)}`
                    }
                    return undefined
                  })() : undefined}
                  size="sm"
                />
                <KpiCard
                  title="Kostnad/st"
                  value={fifoData?.averageCost ?? '-'}
                  format={fifoData ? 'currency' : 'none'}
                  loading={fifoLoading}
                  size="sm"
                />
                <KpiCard
                  title="I lager sedan"
                  value={fifoData ? formatPeriod(getProductOldestDate()) : '-'}
                  format="none"
                  loading={fifoLoading}
                  size="sm"
                />
                <KpiCard
                  title="Totalt inköpt"
                  value={purchaseHistory?.totalQuantityPurchased ?? '-'}
                  suffix={purchaseHistory ? 'st' : undefined}
                  format="number"
                  loading={purchaseHistoryLoading}
                  size="sm"
                />
                <KpiCard
                  title="Första inköpet"
                  value={purchaseHistory?.firstPurchaseDate ? formatPeriod(purchaseHistory.firstPurchaseDate) : '-'}
                  format="none"
                  loading={purchaseHistoryLoading}
                  size="sm"
                />
              </div>

              {/* Variant search and column selector */}
              <TableToolbar
                searchQuery={variantSearch}
                onSearchChange={setVariantSearch}
                searchPlaceholder="Sök variant..."
                columnConfigs={variantColumnConfigs}
                visibleColumns={visibleColumns}
                onToggleColumn={toggleColumn}
                onResetColumns={resetToDefaults}
              />

              {/* Variants table with expandable rows */}
              <InventoryVariantTable
                variants={filteredVariants}
                showZettle={showZettle}
                fifoData={fifoData}
                productImage={product.image}
                visibleColumns={visibleColumns}
                onHistoryClick={(variant) => {
                  setSelectedVariantForHistory(variant)
                  setHistoryDialogOpen(true)
                }}
                onImageClick={setPreviewImage}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <StockHistoryChart
                productNumber={product.productNumber}
                variants={product.variants}
                companyId={companyId}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Purchase History Dialog */}
        {selectedVariantForHistory && (
          <PurchaseHistoryDialog
            open={historyDialogOpen}
            onOpenChange={setHistoryDialogOpen}
            variantId={selectedVariantForHistory.variantId}
            variantName={selectedVariantForHistory.variantName}
            productNumber={product.productNumber}
            companyId={companyId}
          />
        )}

        {/* Image lightbox */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setPreviewImage(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
              aria-label="Stäng"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <Image
              src={previewImage}
              alt="Produktbild"
              width={600}
              height={600}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
    </ResponsiveSheet>
  )
}
