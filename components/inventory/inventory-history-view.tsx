'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, TrendingDown, Clock, Package } from 'lucide-react'
import type { FifoValuationData, ValueByAgeGroup } from '@/types/fifo'
import { formatCurrency, formatAge, AGE_THRESHOLDS } from '@/types/fifo'

interface InventoryHistoryViewProps {
  fifoData: FifoValuationData | null
  isLoading: boolean
}

interface MonthlyDataPoint {
  month: string
  sortKey: string
  fresh: number
  aging: number
  old: number
  veryOld: number
  total: number
}

// Colors matching the age classifications
const AGE_COLORS = {
  fresh: '#22c55e',    // green-500
  aging: '#eab308',    // yellow-500
  old: '#f97316',      // orange-500
  veryOld: '#ef4444',  // red-500
}

const AGE_LABELS = {
  fresh: 'Fräscht (0-90 dagar)',
  aging: 'Åldrande (91-180 dagar)',
  old: 'Gammalt (181-365 dagar)',
  veryOld: 'Mycket gammalt (>365 dagar)',
}

export function InventoryHistoryView({ fifoData, isLoading }: InventoryHistoryViewProps) {
  // Aggregate inventory layers by month of delivery
  const monthlyData = useMemo(() => {
    if (!fifoData) return []

    const monthMap = new Map<string, { fresh: number; aging: number; old: number; veryOld: number }>()

    for (const product of fifoData.products) {
      for (const variant of product.variants) {
        for (const size of variant.sizes) {
          for (const layer of size.inventoryLayers) {
            if (layer.remainingQuantity <= 0) continue

            const date = new Date(layer.deliveryDate)
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

            const existing = monthMap.get(monthKey) || { fresh: 0, aging: 0, old: 0, veryOld: 0 }

            // Classify by age
            const value = layer.layerValue
            if (layer.ageInDays <= AGE_THRESHOLDS.FRESH) {
              existing.fresh += value
            } else if (layer.ageInDays <= AGE_THRESHOLDS.AGING) {
              existing.aging += value
            } else if (layer.ageInDays <= AGE_THRESHOLDS.OLD) {
              existing.old += value
            } else {
              existing.veryOld += value
            }

            monthMap.set(monthKey, existing)
          }
        }
      }
    }

    // Convert to array and sort by date
    const result: MonthlyDataPoint[] = Array.from(monthMap.entries())
      .map(([sortKey, values]) => {
        const [year, month] = sortKey.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        const monthLabel = date.toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' })

        return {
          month: monthLabel,
          sortKey,
          ...values,
          total: values.fresh + values.aging + values.old + values.veryOld,
        }
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

    return result
  }, [fifoData])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!fifoData?.summary) {
      return {
        averageAge: 0,
        totalValue: 0,
        valueByAgeGroup: { fresh: 0, aging: 0, old: 0, veryOld: 0 } as ValueByAgeGroup,
        percentages: { fresh: 0, aging: 0, old: 0, veryOld: 0 },
        oldestMonth: null as string | null,
      }
    }

    const { valueByAgeGroup, totalValue, averageAgeInDays } = fifoData.summary
    const total = totalValue || 1 // Avoid division by zero

    const percentages = {
      fresh: (valueByAgeGroup.fresh / total) * 100,
      aging: (valueByAgeGroup.aging / total) * 100,
      old: (valueByAgeGroup.old / total) * 100,
      veryOld: (valueByAgeGroup.veryOld / total) * 100,
    }

    // Find oldest month with inventory
    let oldestMonth: string | null = null
    if (monthlyData.length > 0) {
      const oldest = monthlyData[0]
      oldestMonth = oldest.month
    }

    return {
      averageAge: averageAgeInDays,
      totalValue,
      valueByAgeGroup,
      percentages,
      oldestMonth,
    }
  }, [fifoData, monthlyData])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!fifoData || monthlyData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Ingen lagerhistorik tillgänglig</h3>
        <p className="text-muted-foreground">Det finns ingen FIFO-data att visa för detta företag.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Genomsnittlig ålder</p>
                <p className="text-2xl font-bold">{formatAge(summaryStats.averageAge)}</p>
                <p className="text-xs text-muted-foreground mt-1">på nuvarande lager</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Äldsta inköp</p>
                <p className="text-2xl font-bold">{summaryStats.oldestMonth || '-'}</p>
                <p className="text-xs text-muted-foreground mt-1">fortfarande i lager</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fräscht lager</p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryStats.percentages.fresh.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(summaryStats.valueByAgeGroup.fresh)}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <div className="h-4 w-4 rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gammalt lager</p>
                <p className="text-2xl font-bold text-red-600">
                  {(summaryStats.percentages.old + summaryStats.percentages.veryOld).toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(summaryStats.valueByAgeGroup.old + summaryStats.valueByAgeGroup.veryOld)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stacked Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lagervärde per inköpsmånad</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visar värdet av nuvarande lager fördelat på vilken månad det köptes in
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Legend
                  formatter={(value) => AGE_LABELS[value as keyof typeof AGE_LABELS] || value}
                />
                <Area
                  type="monotone"
                  dataKey="veryOld"
                  stackId="1"
                  stroke={AGE_COLORS.veryOld}
                  fill={AGE_COLORS.veryOld}
                  fillOpacity={0.8}
                />
                <Area
                  type="monotone"
                  dataKey="old"
                  stackId="1"
                  stroke={AGE_COLORS.old}
                  fill={AGE_COLORS.old}
                  fillOpacity={0.8}
                />
                <Area
                  type="monotone"
                  dataKey="aging"
                  stackId="1"
                  stroke={AGE_COLORS.aging}
                  fill={AGE_COLORS.aging}
                  fillOpacity={0.8}
                />
                <Area
                  type="monotone"
                  dataKey="fresh"
                  stackId="1"
                  stroke={AGE_COLORS.fresh}
                  fill={AGE_COLORS.fresh}
                  fillOpacity={0.8}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Age distribution breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Åldersfördelning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(['fresh', 'aging', 'old', 'veryOld'] as const).map((ageGroup) => {
              const value = summaryStats.valueByAgeGroup[ageGroup]
              const percentage = summaryStats.percentages[ageGroup]

              return (
                <div key={ageGroup} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: AGE_COLORS[ageGroup] }}
                      />
                      {AGE_LABELS[ageGroup]}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(value)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: AGE_COLORS[ageGroup],
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
