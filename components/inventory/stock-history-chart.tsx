'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AggregatedVariant, StockHistoryData, StockHistorySeries } from '@/types/inventory'
import type { CompanyId } from '@/config/companies'

interface StockHistoryChartProps {
  productNumber: string
  variants: AggregatedVariant[]
  companyId: Exclude<CompanyId, 'all'>
}

// Fixed to 30 days until we have more historical data in ES
const DAYS_FILTER = 30

// Generate distinct colors for chart lines
const COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#c026d3', // fuchsia
  '#65a30d', // lime
]

export function StockHistoryChart({
  productNumber,
  variants,
  companyId,
}: StockHistoryChartProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [data, setData] = useState<StockHistoryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get filter values from URL
  const variantParam = searchParams.get('variant')
  const selectedVariant: number | 'all' = variantParam ? parseInt(variantParam, 10) : 'all'
  const selectedSize: string | 'all' = searchParams.get('size') || 'all'

  // Update URL with filter values
  const updateFilter = useCallback((key: string, value: string | number | 'all') => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete(key)
    } else {
      params.set(key, String(value))
    }
    // Clear size when variant changes to 'all'
    if (key === 'variant' && value === 'all') {
      params.delete('size')
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  // Get variants that have data in the chart (filter out all-zero variants)
  const availableVariants = useMemo(() => {
    if (!data) return []
    const variantIds = new Set(data.series.map(s => s.variantId))
    return variants.filter(v => variantIds.has(v.variantId))
  }, [data, variants])

  // Reset selected variant if it's no longer available
  useEffect(() => {
    if (selectedVariant !== 'all' && availableVariants.length > 0) {
      const stillAvailable = availableVariants.some(v => v.variantId === selectedVariant)
      if (!stillAvailable) {
        updateFilter('variant', 'all')
      }
    }
  }, [availableVariants, selectedVariant, updateFilter])

  // Get unique sizes from available variants
  const allSizes = useMemo(() => {
    const sizes = new Set<string>()
    for (const variant of availableVariants) {
      for (const size of variant.sizes) {
        sizes.add(size.size)
      }
    }
    return Array.from(sizes).sort((a, b) => {
      // Try to sort numerically if possible
      const numA = parseFloat(a)
      const numB = parseFloat(b)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB
      }
      return a.localeCompare(b)
    })
  }, [availableVariants])

  // Fetch data when filters change
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          company: companyId,
          productNumber,
          days: String(DAYS_FILTER),
        })

        // When a variant is selected, request per-size breakdown
        if (selectedVariant !== 'all') {
          params.set('variantId', String(selectedVariant))
        }

        const response = await fetch(`/api/inventory/history?${params}`)
        if (!response.ok) {
          throw new Error('Kunde inte hämta historikdata')
        }

        const result: StockHistoryData = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [companyId, productNumber, selectedVariant])

  // Transform data for the chart
  const chartData = useMemo(() => {
    if (!data) return []

    // Get all unique dates
    const dateSet = new Set<string>()
    for (const series of data.series) {
      for (const point of series.data) {
        dateSet.add(point.date)
      }
    }
    const dates = Array.from(dateSet).sort()

    // Build chart data array - use all series from the response
    return dates.map(date => {
      const point: Record<string, string | number> = { date }

      for (const series of data.series) {
        const dataPoint = series.data.find(d => d.date === date)
        point[series.name] = dataPoint?.quantity ?? 0
      }

      return point
    })
  }, [data])

  // Get series names for legend/lines
  const seriesNames = useMemo(() => {
    if (!data) return []
    return data.series.map(s => s.name)
  }, [data])

  // Format date for X axis
  const formatDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
  }

  const currentVariantName = selectedVariant === 'all'
    ? 'Alla varianter'
    : availableVariants.find(v => v.variantId === selectedVariant)?.variantName || 'Variant'

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Variant filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {currentVariantName}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => updateFilter('variant', 'all')}
              className={selectedVariant === 'all' ? 'bg-accent' : ''}
            >
              Alla varianter
            </DropdownMenuItem>
            {availableVariants.map(variant => (
              <DropdownMenuItem
                key={variant.variantId}
                onClick={() => updateFilter('variant', variant.variantId)}
                className={selectedVariant === variant.variantId ? 'bg-accent' : ''}
              >
                {variant.variantName}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Size filter - only show when variant is selected */}
        {selectedVariant !== 'all' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                {selectedSize === 'all' ? 'Alla storlekar' : `Storlek ${selectedSize}`}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
              <DropdownMenuItem
                onClick={() => updateFilter('size', 'all')}
                className={selectedSize === 'all' ? 'bg-accent' : ''}
              >
                Alla storlekar
              </DropdownMenuItem>
              {allSizes.map(size => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => updateFilter('size', size)}
                  className={selectedSize === size ? 'bg-accent' : ''}
                >
                  Storlek {size}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Chart */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : chartData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Ingen historikdata tillgänglig</p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip
                labelFormatter={formatDate}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              {seriesNames.length > 1 && (
                <Legend wrapperStyle={{ fontSize: 12 }} />
              )}
              {seriesNames.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
