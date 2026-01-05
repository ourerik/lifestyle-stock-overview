'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Loader2, ChevronRight, ChevronDown, TrendingUp, TrendingDown, Info } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { VariantPeriodTable } from './variant-period-table'
import { formatCurrency } from '@/lib/utils/currency'
import type { CompanyId } from '@/config/companies'
import type {
  ProductPerformance,
  ProductPerformanceDetail,
  ProductPerformanceDetailResponse,
  VariantPerformance,
  RollingPeriod,
} from '@/types/performance'

interface PerformanceDetailSheetProps {
  product: ProductPerformance | null
  previousProduct: ProductPerformance | null
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: Exclude<CompanyId, 'all'>
  dateRange: { startDate: string; endDate: string }
  periodMonths: number // 12, 9, 6, 3, or 1
  periodLabel: string // e.g. "Ett år", "6 mån"
}

// Calculate percentage change between two values
function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

// Format date range for display
function formatDateRange(dateRange: { startDate: string; endDate: string }) {
  const start = new Date(dateRange.startDate)
  const end = new Date(dateRange.endDate)
  const formatDate = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${formatDate(start)} – ${formatDate(end)}`
}

export function PerformanceDetailSheet({
  product,
  previousProduct,
  open,
  onOpenChange,
  companyId,
  dateRange,
  periodMonths,
  periodLabel,
}: PerformanceDetailSheetProps) {
  const [detailData, setDetailData] = useState<ProductPerformanceDetail | null>(null)
  const [previousVariants, setPreviousVariants] = useState<VariantPerformance[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch detail data when sheet opens
  useEffect(() => {
    if (!open || !product) {
      setDetailData(null)
      setPreviousVariants(null)
      setError(null)
      return
    }

    const fetchDetailData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          company: companyId,
          productNumber: product.productNumber,
          periodMonths: periodMonths.toString(),
        })

        const res = await fetch(`/api/performance/detail?${params}`)

        if (!res.ok) {
          throw new Error('Kunde inte hämta detaljdata')
        }

        const json: ProductPerformanceDetailResponse = await res.json()
        setDetailData(json.data)
        setPreviousVariants(json.previousVariants)
      } catch (err) {
        console.error('Failed to fetch detail data:', err)
        setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDetailData()
  }, [open, product, companyId, periodMonths])

  if (!product) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:!max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <div>
              <div className="text-lg">{product.productName}</div>
              <div className="text-sm font-normal text-muted-foreground">
                {product.productNumber}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 px-6">
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Visar data för <strong>{periodLabel}</strong>: {formatDateRange(dateRange)}.
              {previousProduct && ' Jämförelse mot samma period ett år tidigare.'}
            </AlertDescription>
          </Alert>
        </div>

        <div className="mt-6 space-y-6 px-6">
          {/* KPI Summary Cards - shows data from the selected period (from product prop) */}
          <ProductSummaryCards product={product} previousProduct={previousProduct} />

          {/* Error state */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Variant data */}
          {!isLoading && detailData && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Varianter ({detailData.variants.length})</h3>

              {detailData.variants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen variantdata tillgänglig
                </div>
              ) : (
                <VariantsTable
                  variants={detailData.variants}
                  previousVariants={previousVariants}
                  periodDefinitions={detailData.periodDefinitions}
                />
              )}
            </div>
          )}

          {/* No data fallback */}
          {!isLoading && !detailData && !error && (
            <div className="text-center py-12 text-muted-foreground">
              Klicka på en produkt för att se detaljer
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SummaryCard({
  title,
  value,
  change,
  invertColors = false,
}: {
  title: string
  value: string
  change?: number | null
  invertColors?: boolean
}) {
  const isPositive = change !== null && change !== undefined && change > 0
  const isNegative = change !== null && change !== undefined && change < 0
  const colorClass = invertColors
    ? isPositive ? 'text-red-600' : isNegative ? 'text-green-600' : 'text-muted-foreground'
    : isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
      {change !== null && change !== undefined && (
        <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : isNegative ? (
            <TrendingDown className="h-3 w-3" />
          ) : null}
          <span>{isPositive ? '+' : ''}{change}%</span>
        </div>
      )}
    </div>
  )
}

function ProductSummaryCards({ product, previousProduct }: { product: ProductPerformance; previousProduct: ProductPerformance | null }) {
  // Calculate changes vs previous period
  const changes = previousProduct ? {
    salesQuantity: calculateChange(product.salesQuantity, previousProduct.salesQuantity),
    turnover: calculateChange(product.turnover, previousProduct.turnover),
    tb: calculateChange(product.tb, previousProduct.tb),
    tbPercent: calculateChange(product.tbPercent, previousProduct.tbPercent),
    returnRate: calculateChange(product.returnRate, previousProduct.returnRate),
    avgDiscount: calculateChange(product.avgDiscountPercent, previousProduct.avgDiscountPercent),
    medianAge: product.medianCustomerAge && previousProduct.medianCustomerAge
      ? calculateChange(product.medianCustomerAge, previousProduct.medianCustomerAge)
      : null,
  } : null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      <SummaryCard
        title="Försäljning"
        value={`${product.salesQuantity.toLocaleString('sv-SE')} st`}
        change={changes?.salesQuantity}
      />
      <SummaryCard
        title="Omsättning"
        value={formatCurrency(product.turnover)}
        change={changes?.turnover}
      />
      <SummaryCard
        title="TB"
        value={formatCurrency(product.tb)}
        change={changes?.tb}
      />
      <SummaryCard
        title="TB%"
        value={`${product.tbPercent}%`}
        change={changes?.tbPercent}
      />
      <SummaryCard
        title="Returgrad"
        value={`${product.returnRate}%`}
        change={changes?.returnRate}
        invertColors
      />
      <SummaryCard
        title="Snittrabatt"
        value={`${product.avgDiscountPercent}%`}
        change={changes?.avgDiscount}
        invertColors
      />
      <SummaryCard
        title="Med. ålder"
        value={product.medianCustomerAge !== null ? `${product.medianCustomerAge} år` : '-'}
        change={changes?.medianAge}
      />
    </div>
  )
}

// Format return rate with color
function formatReturnRate(rate: number) {
  const className = rate > 20
    ? 'text-destructive'
    : rate > 10
    ? 'text-yellow-600'
    : ''
  return <span className={className}>{rate}%</span>
}

// Format TB% with color
function formatTbPercent(percent: number) {
  const className = percent < 0
    ? 'text-destructive'
    : percent < 30
    ? 'text-yellow-600'
    : 'text-green-600'
  return <span className={className}>{percent}%</span>
}

// Change indicator component
function ChangeIndicator({
  change,
  invertColors = false,
}: {
  change: number | null
  invertColors?: boolean
}) {
  if (change === null) return null

  const isPositive = change > 0
  const isNegative = change < 0
  const colorClass = invertColors
    ? isPositive ? 'text-red-500' : isNegative ? 'text-green-500' : 'text-muted-foreground'
    : isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'

  return (
    <span className={`flex items-center justify-end gap-0.5 text-xs ${colorClass}`}>
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : isNegative ? (
        <TrendingDown className="h-3 w-3" />
      ) : null}
      <span>{isPositive ? '+' : ''}{change}%</span>
    </span>
  )
}

function VariantsTable({
  variants,
  previousVariants,
  periodDefinitions,
}: {
  variants: VariantPerformance[]
  previousVariants: VariantPerformance[] | null
  periodDefinitions: RollingPeriod[]
}) {
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())

  // Create a map of previous variants for easy lookup
  const previousVariantsMap = useMemo(() => {
    if (!previousVariants) return null
    const map = new Map<string, VariantPerformance>()
    previousVariants.forEach(v => map.set(v.variantNumber, v))
    return map
  }, [previousVariants])

  const toggleVariant = (variantNumber: string) => {
    setExpandedVariants(prev => {
      const next = new Set(prev)
      if (next.has(variantNumber)) {
        next.delete(variantNumber)
      } else {
        next.add(variantNumber)
      }
      return next
    })
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Variant</TableHead>
            <TableHead className="text-right">Sålt</TableHead>
            <TableHead className="text-right">Omsättning</TableHead>
            <TableHead className="text-right">TB</TableHead>
            <TableHead className="text-right">TB%</TableHead>
            <TableHead className="text-right">Retur%</TableHead>
            <TableHead className="text-right">Rabatt</TableHead>
            <TableHead className="text-right">Med. ålder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((variant) => {
            const isExpanded = expandedVariants.has(variant.variantNumber)
            const prev = previousVariantsMap?.get(variant.variantNumber)
            const changes = prev ? {
              sales: calculateChange(variant.totalSalesQuantity, prev.totalSalesQuantity),
              turnover: calculateChange(variant.totalTurnover, prev.totalTurnover),
              tb: calculateChange(variant.totalTb, prev.totalTb),
              tbPercent: calculateChange(variant.totalTbPercent, prev.totalTbPercent),
              returnRate: calculateChange(variant.totalReturnRate, prev.totalReturnRate),
              discount: calculateChange(variant.totalAvgDiscountPercent, prev.totalAvgDiscountPercent),
              age: variant.medianCustomerAge && prev.medianCustomerAge
                ? calculateChange(variant.medianCustomerAge, prev.medianCustomerAge)
                : null,
            } : null

            return (
              <React.Fragment key={variant.variantNumber}>
                <TableRow
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleVariant(variant.variantNumber)}
                >
                  <TableCell className="w-8">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{variant.variantName}</div>
                    <div className="text-xs text-muted-foreground">{variant.variantNumber}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">{variant.totalSalesQuantity}</div>
                    <ChangeIndicator change={changes?.sales ?? null} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">{formatCurrency(variant.totalTurnover)}</div>
                    <ChangeIndicator change={changes?.turnover ?? null} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">{formatCurrency(variant.totalTb)}</div>
                    <ChangeIndicator change={changes?.tb ?? null} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{formatTbPercent(variant.totalTbPercent)}</div>
                    <ChangeIndicator change={changes?.tbPercent ?? null} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{formatReturnRate(variant.totalReturnRate)}</div>
                    <ChangeIndicator change={changes?.returnRate ?? null} invertColors />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <div>{variant.totalAvgDiscountPercent > 0 ? `${variant.totalAvgDiscountPercent}%` : '-'}</div>
                    <ChangeIndicator change={changes?.discount ?? null} invertColors />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <div>{variant.medianCustomerAge !== null ? `${variant.medianCustomerAge} år` : '-'}</div>
                    <ChangeIndicator change={changes?.age ?? null} />
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <tr>
                    <td colSpan={9} className="p-0 border-b">
                      <VariantPeriodTable
                        variant={variant}
                        periodDefinitions={periodDefinitions}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
