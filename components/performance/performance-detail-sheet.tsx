'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react'
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
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: Exclude<CompanyId, 'all'>
  dateRange: { startDate: string; endDate: string }
}

export function PerformanceDetailSheet({
  product,
  open,
  onOpenChange,
  companyId,
}: PerformanceDetailSheetProps) {
  const [detailData, setDetailData] = useState<ProductPerformanceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch detail data when sheet opens
  useEffect(() => {
    if (!open || !product) {
      setDetailData(null)
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
        })
        const res = await fetch(`/api/performance/detail?${params}`)
        if (!res.ok) {
          throw new Error('Kunde inte hämta detaljdata')
        }
        const json: ProductPerformanceDetailResponse = await res.json()
        setDetailData(json.data)
      } catch (err) {
        console.error('Failed to fetch detail data:', err)
        setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDetailData()
  }, [open, product, companyId])

  if (!product) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:!max-w-4xl overflow-y-auto">
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

        <div className="mt-6 space-y-6 px-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard title="Sålt" value={`${product.salesQuantity.toLocaleString('sv-SE')} st`} />
            <SummaryCard title="Retur%" value={`${product.returnRate}%`} />
            <SummaryCard title="TB%" value={`${product.tbPercent}%`} />
            <SummaryCard
              title="Ålder"
              value={product.medianCustomerAge !== null ? `${product.medianCustomerAge} år` : '-'}
            />
          </div>

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

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
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

function VariantsTable({
  variants,
  periodDefinitions,
}: {
  variants: VariantPerformance[]
  periodDefinitions: RollingPeriod[]
}) {
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())

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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Variant</TableHead>
            <TableHead className="text-right w-16">Sålt</TableHead>
            <TableHead className="text-right w-16">Retur%</TableHead>
            <TableHead className="text-right w-16">Ålder</TableHead>
            <TableHead className="text-right w-16">Rabatt</TableHead>
            <TableHead className="text-right w-16">TB%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((variant) => {
            const isExpanded = expandedVariants.has(variant.variantNumber)
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
                  <TableCell className="text-right font-medium">
                    {variant.totalSalesQuantity}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatReturnRate(variant.totalReturnRate)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {variant.medianCustomerAge ?? '-'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {variant.totalAvgDiscountPercent > 0 ? `${variant.totalAvgDiscountPercent}%` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatTbPercent(variant.totalTbPercent)}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="p-0 border-b">
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
