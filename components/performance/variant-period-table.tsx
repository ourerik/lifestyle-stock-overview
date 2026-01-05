'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { VariantPerformance, RollingPeriod, PeriodMetrics } from '@/types/performance'

interface VariantPeriodTableProps {
  variant: VariantPerformance
  periodDefinitions: RollingPeriod[]
}

export function VariantPeriodTable({ variant, periodDefinitions }: VariantPeriodTableProps) {
  // Get period metrics by index for easy lookup
  const getPeriodMetrics = (periodIndex: number): PeriodMetrics | undefined => {
    return variant.periods.find(p => p.period.periodIndex === periodIndex)
  }

  // Format value with color for return rate
  const formatReturnRate = (rate: number) => {
    const className = rate > 20
      ? 'text-destructive'
      : rate > 10
      ? 'text-yellow-600'
      : ''
    return <span className={className}>{rate}%</span>
  }

  // Format value with color for TB%
  const formatTbPercent = (percent: number) => {
    const className = percent < 0
      ? 'text-destructive'
      : percent < 30
      ? 'text-yellow-600'
      : 'text-green-600'
    return <span className={className}>{percent}%</span>
  }

  // Sorted period definitions (newest first - 0-90d on left)
  const sortedPeriodDefs = [...periodDefinitions].sort((a, b) => a.periodIndex - b.periodIndex)

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/50">
            <TableHead className="w-20 border-r"></TableHead>
            {sortedPeriodDefs.map((period) => (
              <TableHead key={period.periodIndex} className="text-center text-xs border-r">
                {period.label}
              </TableHead>
            ))}
            <TableHead className="text-center text-xs font-semibold">Totalt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Sales quantity row */}
          <TableRow className="border-b">
            <TableCell className="text-xs text-muted-foreground border-r">Sålt</TableCell>
            {sortedPeriodDefs.map((period) => {
              const metrics = getPeriodMetrics(period.periodIndex)
              return (
                <TableCell key={period.periodIndex} className="text-center text-sm border-r">
                  {metrics?.salesQuantity ?? '-'}
                </TableCell>
              )
            })}
            <TableCell className="text-center text-sm font-medium border-l">
              {variant.totalSalesQuantity}
            </TableCell>
          </TableRow>

          {/* Return rate row */}
          <TableRow className="border-b">
            <TableCell className="text-xs text-muted-foreground border-r">Retur%</TableCell>
            {sortedPeriodDefs.map((period) => {
              const metrics = getPeriodMetrics(period.periodIndex)
              return (
                <TableCell key={period.periodIndex} className="text-center text-sm border-r">
                  {metrics ? formatReturnRate(metrics.returnRate) : '-'}
                </TableCell>
              )
            })}
            <TableCell className="text-center text-sm font-medium border-l">
              {formatReturnRate(variant.totalReturnRate)}
            </TableCell>
          </TableRow>

          {/* Median age row */}
          <TableRow className="border-b">
            <TableCell className="text-xs text-muted-foreground border-r">Ålder</TableCell>
            {sortedPeriodDefs.map((period) => {
              const metrics = getPeriodMetrics(period.periodIndex)
              return (
                <TableCell key={period.periodIndex} className="text-center text-sm text-muted-foreground border-r">
                  {metrics?.medianCustomerAge ?? '-'}
                </TableCell>
              )
            })}
            <TableCell className="text-center text-sm font-medium text-muted-foreground border-l">
              {variant.medianCustomerAge ?? '-'}
            </TableCell>
          </TableRow>

          {/* Discount row */}
          <TableRow className="border-b">
            <TableCell className="text-xs text-muted-foreground border-r">Rabatt</TableCell>
            {sortedPeriodDefs.map((period) => {
              const metrics = getPeriodMetrics(period.periodIndex)
              return (
                <TableCell key={period.periodIndex} className="text-center text-sm text-muted-foreground border-r">
                  {metrics ? `${metrics.avgDiscountPercent}%` : '-'}
                </TableCell>
              )
            })}
            <TableCell className="text-center text-sm font-medium text-muted-foreground border-l">
              {variant.totalAvgDiscountPercent}%
            </TableCell>
          </TableRow>

          {/* TB% row */}
          <TableRow className="border-b">
            <TableCell className="text-xs text-muted-foreground border-r">TB%</TableCell>
            {sortedPeriodDefs.map((period) => {
              const metrics = getPeriodMetrics(period.periodIndex)
              return (
                <TableCell key={period.periodIndex} className="text-center text-sm border-r">
                  {metrics ? formatTbPercent(metrics.tbPercent) : '-'}
                </TableCell>
              )
            })}
            <TableCell className="text-center text-sm font-medium border-l">
              {formatTbPercent(variant.totalTbPercent)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
