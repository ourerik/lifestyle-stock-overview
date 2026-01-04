'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadges } from './status-badge'
import { StockHistoryChart } from './stock-history-chart'
import type { AggregatedProduct } from '@/types/inventory'
import type { CompanyId } from '@/config/companies'
import type { FifoProductValuation } from '@/types/fifo'
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

  // Get FIFO data for a specific size (EAN)
  const getSizeFifo = useCallback((ean: string) => {
    if (!fifoData) return null
    for (const variant of fifoData.variants) {
      const size = variant.sizes.find(s => s.EAN === ean)
      if (size) return size
    }
    return null
  }, [fifoData])

  // Get FIFO data for a specific variant
  const getVariantFifo = useCallback((variantId: number) => {
    if (!fifoData) return null
    return fifoData.variants.find(v => v.variantId === variantId) || null
  }, [fifoData])

  // Get oldest purchase date from a variant's sizes
  const getVariantOldestDate = useCallback((variantId: number): string | null => {
    const variantFifo = getVariantFifo(variantId)
    if (!variantFifo) return null
    let oldest: string | null = null
    for (const size of variantFifo.sizes) {
      if (size.oldestPurchaseDate && (!oldest || size.oldestPurchaseDate < oldest)) {
        oldest = size.oldestPurchaseDate
      }
    }
    return oldest
  }, [getVariantFifo])

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

  // Filter variants based on stock filter
  const filteredVariants = useMemo(() => {
    if (!product) return []

    if (stockFilter === 'in-stock') {
      return product.variants.filter(variant =>
        variant.totalQuantity > 0 ||
        variant.zettleQuantity > 0 ||
        variant.totalIncoming > 0
      )
    }

    return product.variants
  }, [product, stockFilter])

  if (!product) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:!max-w-4xl overflow-y-auto">
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

        <div className="mt-6 space-y-6 px-6">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{product.totalQuantity}</div>
              <div className="text-xs text-muted-foreground">Lager</div>
            </div>
            {showZettle && (
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{product.totalZettleQuantity}</div>
                <div className="text-xs text-muted-foreground">Butik</div>
              </div>
            )}
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {product.totalIncoming > 0 ? `+${product.totalIncoming}` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Inkommande</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              {fifoLoading ? (
                <div className="text-lg text-muted-foreground">...</div>
              ) : fifoData ? (
                <div className="text-lg font-bold">{formatCurrency(fifoData.totalValue)}</div>
              ) : (
                <div className="text-lg text-muted-foreground">-</div>
              )}
              <div className="text-xs text-muted-foreground">Lagervärde</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              {fifoLoading ? (
                <div className="text-lg text-muted-foreground">...</div>
              ) : fifoData ? (
                <div className="text-lg font-bold">{formatCurrency(fifoData.averageCost)}</div>
              ) : (
                <div className="text-lg text-muted-foreground">-</div>
              )}
              <div className="text-xs text-muted-foreground">Kostnad/st</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              {fifoLoading ? (
                <div className="text-lg text-muted-foreground">...</div>
              ) : fifoData ? (
                <div className={`text-lg font-bold ${getAgeColorClass(fifoData.maxAgeInDays)}`}>
                  {formatPeriod(getProductOldestDate())}
                </div>
              ) : (
                <div className="text-lg text-muted-foreground">-</div>
              )}
              <div className="text-xs text-muted-foreground">I lager sedan</div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <TabsList>
              <TabsTrigger value="variants">Varianter i lager</TabsTrigger>
              <TabsTrigger value="history">Historik</TabsTrigger>
            </TabsList>

            <TabsContent value="variants" className="mt-4 space-y-4">
              {filteredVariants.map(variant => (
              <div key={variant.variantId} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {variant.image && variant.image !== product.image ? (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(variant.image!)}
                      className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                    >
                      <Image
                        src={variant.image}
                        alt={variant.variantName}
                        width={48}
                        height={48}
                        className="rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    </button>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{variant.variantName}</div>
                    <div className="text-xs text-muted-foreground">{variant.variantNumber}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{variant.totalQuantity}</div>
                    {variant.totalIncoming > 0 && (
                      <div className="text-xs text-blue-600">+{variant.totalIncoming}</div>
                    )}
                  </div>
                  {(() => {
                    const variantFifo = getVariantFifo(variant.variantId)
                    if (!variantFifo) return null
                    const oldestDate = getVariantOldestDate(variant.variantId)
                    return (
                      <div className="text-right ml-4 border-l pl-4">
                        <div className="text-sm font-medium">{formatCurrency(variantFifo.totalValue)}</div>
                        <div className={`text-xs ${getAgeColorClass(variantFifo.maxAgeInDays)}`}>
                          {formatPeriod(oldestDate)}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Sizes table - sizes as columns, stock locations as rows */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24"></TableHead>
                        {variant.sizes.map(size => (
                          <TableHead key={size.EAN} className="text-center min-w-[50px]">
                            {size.size}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Warehouse stock row */}
                      <TableRow>
                        <TableCell className="font-medium">Lager</TableCell>
                        {variant.sizes.map(size => (
                          <TableCell
                            key={size.EAN}
                            className={`text-center font-semibold ${
                              size.quantity === 0
                                ? 'text-muted-foreground'
                                : size.quantity < 2
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : ''
                            }`}
                          >
                            {size.quantity}
                          </TableCell>
                        ))}
                      </TableRow>
                      {/* Zettle/Store stock row */}
                      {showZettle && (
                        <TableRow>
                          <TableCell className="font-medium">Butik</TableCell>
                          {variant.sizes.map(size => (
                            <TableCell
                              key={size.EAN}
                              className={`text-center ${
                                size.zettleQuantity === 0 ? 'text-muted-foreground' : ''
                              }`}
                            >
                              {size.zettleQuantity > 0 ? size.zettleQuantity : '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      )}
                      {/* Incoming stock row */}
                      <TableRow>
                        <TableCell className="font-medium">Inkommande</TableCell>
                        {variant.sizes.map(size => (
                          <TableCell key={size.EAN} className="text-center">
                            {size.incoming > 0 ? (
                              <span className="text-blue-600 font-medium">+{size.incoming}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      {/* FIFO Value row */}
                      {fifoData && (
                        <TableRow>
                          <TableCell className="font-medium">Värde</TableCell>
                          {variant.sizes.map(size => {
                            const sizeFifo = getSizeFifo(size.EAN)
                            return (
                              <TableCell key={size.EAN} className="text-center text-xs">
                                {sizeFifo && sizeFifo.totalValue > 0 ? (
                                  <span>{formatCurrency(sizeFifo.totalValue)}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )}
                      {/* FIFO oldest date row */}
                      {fifoData && (
                        <TableRow>
                          <TableCell className="font-medium">I lager</TableCell>
                          {variant.sizes.map(size => {
                            const sizeFifo = getSizeFifo(size.EAN)
                            return (
                              <TableCell key={size.EAN} className="text-center text-xs">
                                {sizeFifo?.oldestPurchaseDate ? (
                                  <span className={getAgeColorClass(sizeFifo.maxAgeInDays)}>
                                    {formatPeriod(sizeFifo.oldestPurchaseDate)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
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
      </SheetContent>
    </Sheet>
  )
}
