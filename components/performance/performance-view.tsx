'use client'

import { useState, useMemo } from 'react'
import { RefreshCw, Search, AlertCircle, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { PerformanceTable } from './performance-table'
import { formatCurrency } from '@/lib/utils/currency'
import type { PerformanceData } from '@/types/performance'

interface PerformanceViewProps {
  data: PerformanceData | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  onRefresh: () => void
  cachedAt: Date | null
  fromCache: boolean
  dateRange: { startDate: string; endDate: string }
  onDateRangeChange: (startDate: string, endDate: string) => void
}

function KpiCard({
  title,
  value,
  suffix,
  loading,
}: {
  title: string
  value: string | number
  suffix?: string
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">
          {value}
          {suffix && <span className="text-lg font-normal text-muted-foreground">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  )
}

export function PerformanceView({
  data,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  cachedAt,
  fromCache,
  dateRange,
  onDateRangeChange,
}: PerformanceViewProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!data?.products) return []
    if (!searchQuery) return data.products

    const query = searchQuery.toLowerCase()
    return data.products.filter(
      (p) =>
        p.productName.toLowerCase().includes(query) ||
        p.productNumber.toLowerCase().includes(query)
    )
  }, [data?.products, searchQuery])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const summary = data?.summary

  return (
    <div className="space-y-6">
      {/* Header with date range and refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => onDateRangeChange(e.target.value, dateRange.endDate)}
              className="w-36"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => onDateRangeChange(dateRange.startDate, e.target.value)}
              className="w-36"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cachedAt && (
            <span className="text-sm text-muted-foreground">
              {fromCache ? 'Cachad' : 'Uppdaterad'} {cachedAt.toLocaleTimeString('sv-SE')}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Försäljning"
          value={isLoading ? '' : `${summary?.totalSalesQuantity.toLocaleString('sv-SE')} st`}
          loading={isLoading}
        />
        <KpiCard
          title="Omsättning"
          value={isLoading ? '' : formatCurrency(summary?.totalTurnover || 0)}
          loading={isLoading}
        />
        <KpiCard
          title="Returgrad"
          value={isLoading ? '' : `${summary?.totalReturnRate || 0}`}
          suffix="%"
          loading={isLoading}
        />
        <KpiCard
          title="TB%"
          value={isLoading ? '' : `${summary?.totalTbPercent || 0}`}
          suffix="%"
          loading={isLoading}
        />
        <KpiCard
          title="TB% m. annonser"
          value={isLoading ? '' : `${summary?.totalTbPercentWithAds || 0}`}
          suffix="%"
          loading={isLoading}
        />
      </div>

      {/* Ad cost info */}
      {data && (
        <Alert>
          <AlertDescription>
            Annonskostnad per order: <strong>{data.adCostPerOrder} SEK</strong>
            {data.adCostPerOrder === 100 && (
              <span className="text-muted-foreground ml-2">(standardvärde - inga annonskostnader inlagda)</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sök produkt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {data && (
          <span className="text-sm text-muted-foreground">
            {filteredProducts.length} av {data.products.length} produkter
          </span>
        )}
      </div>

      {/* Table */}
      <PerformanceTable products={filteredProducts} isLoading={isLoading} />
    </div>
  )
}
