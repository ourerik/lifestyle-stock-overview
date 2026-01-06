'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Loader2, ChevronRight, ChevronDown, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import {
  ResponsiveSheet,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/responsive-sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MobileFullBleed } from '@/components/ui/mobile-full-bleed'
import { KpiCard } from '@/components/ui/kpi-card'
import { TableToolbar } from '@/components/ui/table-toolbar'
import { useColumnVisibility, type ColumnConfig } from '@/hooks/use-column-visibility'
import { VariantPeriodTable } from './variant-period-table'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateRangeShort } from '@/lib/utils/date'
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
  onRefresh: () => void
  isRefreshing: boolean
}

// Calculate percentage change between two values
function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}


export function PerformanceDetailSheet({
  product,
  previousProduct,
  open,
  onOpenChange,
  companyId,
  dateRange,
  periodMonths,
  onRefresh,
  isRefreshing,
}: PerformanceDetailSheetProps) {
  const [detailData, setDetailData] = useState<ProductPerformanceDetail | null>(null)
  const [previousVariants, setPreviousVariants] = useState<VariantPerformance[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [variantSearch, setVariantSearch] = useState('')

  // Column configs for variant table
  const variantColumnConfigs: ColumnConfig[] = useMemo(() => [
    { id: 'variant', label: 'Variant', defaultVisible: true },
    { id: 'sales', label: 'Sålt', defaultVisible: true },
    { id: 'turnover', label: 'Omsättning', defaultVisible: true },
    { id: 'tb', label: 'TB', defaultVisible: true },
    { id: 'tbPercent', label: 'TB%', defaultVisible: true },
    { id: 'returnRate', label: 'Retur%', defaultVisible: true },
    { id: 'discount', label: 'Rabatt', defaultVisible: false },
    { id: 'age', label: 'Med. ålder', defaultVisible: false },
  ], [])

  const { visibleColumns, toggleColumn, resetToDefaults } = useColumnVisibility(
    'performance-variant-detail',
    variantColumnConfigs
  )

  // Filter variants based on search
  const filteredVariants = useMemo(() => {
    if (!detailData?.variants) return []
    if (!variantSearch) return detailData.variants

    const query = variantSearch.toLowerCase()
    return detailData.variants.filter(v =>
      v.variantName.toLowerCase().includes(query) ||
      v.variantNumber.toLowerCase().includes(query)
    )
  }, [detailData?.variants, variantSearch])

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
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      desktopClassName="sm:!max-w-5xl"
    >
      <SheetHeader>
        <div className="flex items-start justify-between gap-4">
          <SheetTitle>
            <div>
              <div className="text-lg">{product.productName}</div>
              <div className="text-sm font-normal text-muted-foreground">
                {product.productNumber}
              </div>
            </div>
          </SheetTitle>
          <div className="flex rounded-md border bg-background shrink-0">
            <span className="px-3 text-xs text-muted-foreground flex items-center border-r">
              {formatDateRangeShort(dateRange)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </SheetHeader>

      <div className="mt-6 space-y-6 px-4 md:px-6 pb-6">
        {/* KPI Summary Cards - shows data from the selected period (from product prop) */}
        <ProductSummaryCards product={product} previousProduct={previousProduct} />

        {/* Error state */}
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Varianter ({filteredVariants.length})</h3>
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

            {filteredVariants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {variantSearch ? 'Inga varianter matchade sökningen' : 'Ingen variantdata tillgänglig'}
              </div>
            ) : (
              <VariantsTable
                variants={filteredVariants}
                previousVariants={previousVariants}
                periodDefinitions={detailData.periodDefinitions}
                visibleColumns={visibleColumns}
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
    </ResponsiveSheet>
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
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 md:mx-0 md:px-0 md:grid md:grid-cols-4 lg:grid-cols-7 md:gap-3 md:overflow-visible md:pb-0">
      <KpiCard
        title="Försäljning"
        value={product.salesQuantity}
        suffix="st"
        format="number"
        change={changes?.salesQuantity}
        size="sm"
      />
      <KpiCard
        title="Omsättning"
        value={product.turnover}
        format="currency"
        change={changes?.turnover}
        size="sm"
      />
      <KpiCard
        title="TB"
        value={product.tb}
        format="currency"
        change={changes?.tb}
        size="sm"
      />
      <KpiCard
        title="TB%"
        value={product.tbPercent}
        suffix="%"
        change={changes?.tbPercent}
        size="sm"
      />
      <KpiCard
        title="Returgrad"
        value={product.returnRate}
        suffix="%"
        change={changes?.returnRate}
        invertColors
        size="sm"
      />
      <KpiCard
        title="Snittrabatt"
        value={product.avgDiscountPercent}
        suffix="%"
        change={changes?.avgDiscount}
        invertColors
        size="sm"
      />
      <KpiCard
        title="Med. ålder"
        value={product.medianCustomerAge !== null ? product.medianCustomerAge : '-'}
        suffix={product.medianCustomerAge !== null ? 'år' : undefined}
        change={changes?.medianAge}
        size="sm"
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
  visibleColumns,
}: {
  variants: VariantPerformance[]
  previousVariants: VariantPerformance[] | null
  periodDefinitions: RollingPeriod[]
  visibleColumns?: string[]
}) {
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())

  // Helper to check if a column is visible
  const isColumnVisible = (columnId: string) => {
    if (!visibleColumns) return true
    return visibleColumns.includes(columnId)
  }

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
    <MobileFullBleed>
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            {isColumnVisible('variant') && <TableHead>Variant</TableHead>}
            {isColumnVisible('sales') && <TableHead className="text-right">Sålt</TableHead>}
            {isColumnVisible('turnover') && <TableHead className="text-right">Omsättning</TableHead>}
            {isColumnVisible('tb') && <TableHead className="text-right">TB</TableHead>}
            {isColumnVisible('tbPercent') && <TableHead className="text-right">TB%</TableHead>}
            {isColumnVisible('returnRate') && <TableHead className="text-right">Retur%</TableHead>}
            {isColumnVisible('discount') && <TableHead className="text-right">Rabatt</TableHead>}
            {isColumnVisible('age') && <TableHead className="text-right">Med. ålder</TableHead>}
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
                  {isColumnVisible('variant') && (
                    <TableCell>
                      <div className="font-medium text-sm">{variant.variantName}</div>
                      <div className="text-xs text-muted-foreground">{variant.variantNumber}</div>
                    </TableCell>
                  )}
                  {isColumnVisible('sales') && (
                    <TableCell className="text-right">
                      <div className="font-medium">{variant.totalSalesQuantity}</div>
                      <ChangeIndicator change={changes?.sales ?? null} />
                    </TableCell>
                  )}
                  {isColumnVisible('turnover') && (
                    <TableCell className="text-right">
                      <div className="font-medium">{formatCurrency(variant.totalTurnover)}</div>
                      <ChangeIndicator change={changes?.turnover ?? null} />
                    </TableCell>
                  )}
                  {isColumnVisible('tb') && (
                    <TableCell className="text-right">
                      <div className="font-medium">{formatCurrency(variant.totalTb)}</div>
                      <ChangeIndicator change={changes?.tb ?? null} />
                    </TableCell>
                  )}
                  {isColumnVisible('tbPercent') && (
                    <TableCell className="text-right">
                      <div>{formatTbPercent(variant.totalTbPercent)}</div>
                      <ChangeIndicator change={changes?.tbPercent ?? null} />
                    </TableCell>
                  )}
                  {isColumnVisible('returnRate') && (
                    <TableCell className="text-right">
                      <div>{formatReturnRate(variant.totalReturnRate)}</div>
                      <ChangeIndicator change={changes?.returnRate ?? null} invertColors />
                    </TableCell>
                  )}
                  {isColumnVisible('discount') && (
                    <TableCell className="text-right text-muted-foreground">
                      <div>{variant.totalAvgDiscountPercent > 0 ? `${variant.totalAvgDiscountPercent}%` : '-'}</div>
                      <ChangeIndicator change={changes?.discount ?? null} invertColors />
                    </TableCell>
                  )}
                  {isColumnVisible('age') && (
                    <TableCell className="text-right text-muted-foreground">
                      <div>{variant.medianCustomerAge !== null ? `${variant.medianCustomerAge} år` : '-'}</div>
                      <ChangeIndicator change={changes?.age ?? null} />
                    </TableCell>
                  )}
                </TableRow>
                {isExpanded && (
                  <tr>
                    <td colSpan={100} className="p-0 border-b">
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
    </MobileFullBleed>
  )
}
