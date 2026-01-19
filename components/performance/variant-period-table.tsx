'use client'

import { useMemo } from 'react'
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

  // Calculate totals from all periods (always sum all 4 periods shown in table)
  const calculatedTotals = useMemo(() => {
    let salesQuantity = 0
    let returnQuantity = 0
    let turnover = 0
    let costs = 0
    let discountWeightedSum = 0
    let discountCount = 0
    let ageWeightedSum = 0
    let ageCount = 0

    for (const period of variant.periods) {
      salesQuantity += period.salesQuantity
      returnQuantity += period.returnQuantity
      turnover += period.turnover
      costs += period.costs

      if (period.avgDiscountPercent > 0) {
        discountWeightedSum += period.avgDiscountPercent * period.salesQuantity
        discountCount += period.salesQuantity
      }

      if (period.medianCustomerAge && period.medianCustomerAge > 0) {
        ageWeightedSum += period.medianCustomerAge * period.salesQuantity
        ageCount += period.salesQuantity
      }
    }

    const returnRate = salesQuantity > 0
      ? Math.round((returnQuantity / salesQuantity) * 1000) / 10
      : 0
    const tb = turnover - costs
    const tbPercent = turnover > 0
      ? Math.round((tb / turnover) * 1000) / 10
      : 0
    const avgDiscountPercent = discountCount > 0
      ? Math.round((discountWeightedSum / discountCount) * 10) / 10
      : 0
    const medianCustomerAge = ageCount > 0
      ? Math.round(ageWeightedSum / ageCount)
      : null

    return {
      salesQuantity,
      returnRate,
      medianCustomerAge,
      avgDiscountPercent,
      tbPercent,
    }
  }, [variant.periods])

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
              {calculatedTotals.salesQuantity}
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
              {formatReturnRate(calculatedTotals.returnRate)}
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
              {calculatedTotals.medianCustomerAge ?? '-'}
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
              {calculatedTotals.avgDiscountPercent}%
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
              {formatTbPercent(calculatedTotals.tbPercent)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
