'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { RefreshCw, Search, AlertCircle, Info, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PerformanceTable } from './performance-table'
import { PerformanceDetailSheet } from './performance-detail-sheet'
import { formatCurrency } from '@/lib/utils/currency'
import type { CompanyId } from '@/config/companies'
import type { PerformanceData, ProductPerformance } from '@/types/performance'
import type { PerformancePeriod } from './performance-page-view'

const PERIOD_LABELS: Record<PerformancePeriod, string> = {
  '1y': 'Ett år',
  '9m': '9 mån',
  '6m': '6 mån',
  '3m': '3 mån',
  '1m': '1 mån',
}

interface PerformanceViewProps {
  data: PerformanceData | null
  previousData: PerformanceData | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  onRefresh: () => void
  cachedAt: Date | null
  fromCache: boolean
  dateRange: { startDate: string; endDate: string }
  selectedPeriod: PerformancePeriod
  onPeriodChange: (period: PerformancePeriod) => void
  companyId: Exclude<CompanyId, 'all'>
}

// Calculate percentage change between two values
function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function KpiCard({
  title,
  value,
  suffix,
  loading,
  change,
  invertColors = false,
}: {
  title: string
  value: string | number
  suffix?: string
  loading?: boolean
  change?: number | null
  invertColors?: boolean // For metrics where lower is better (like return rate)
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-16 mt-1" />
        </CardContent>
      </Card>
    )
  }

  const isPositive = change !== null && change !== undefined && change > 0
  const isNegative = change !== null && change !== undefined && change < 0
  const colorClass = invertColors
    ? isPositive ? 'text-red-600' : isNegative ? 'text-green-600' : 'text-muted-foreground'
    : isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'

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
        {change !== null && change !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${colorClass}`}>
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : isNegative ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            <span>{isPositive ? '+' : ''}{change}% vs ett år tidigare</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PerformanceView({
  data,
  previousData,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  cachedAt,
  fromCache,
  dateRange,
  selectedPeriod,
  onPeriodChange,
  companyId,
}: PerformanceViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Get selected product from URL
  const productParam = searchParams.get('product')

  // Find selected product by productNumber
  const selectedProduct = useMemo(() => {
    if (!productParam || !data) return null
    return data.products.find(p => p.productNumber === productParam) || null
  }, [productParam, data])

  // Update URL when selecting/deselecting product
  const updateProductParam = useCallback((product: ProductPerformance | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (product) {
      params.set('product', product.productNumber)
    } else {
      params.delete('product')
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

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
  const previousSummary = previousData?.summary

  // Calculate changes vs previous period
  const changes = useMemo(() => {
    if (!summary || !previousSummary) return null
    return {
      salesQuantity: calculateChange(summary.totalSalesQuantity, previousSummary.totalSalesQuantity),
      turnover: calculateChange(summary.totalTurnover, previousSummary.totalTurnover),
      returnRate: calculateChange(summary.totalReturnRate, previousSummary.totalReturnRate),
      tb: calculateChange(summary.totalTb, previousSummary.totalTb),
      tbPercent: calculateChange(summary.totalTbPercent, previousSummary.totalTbPercent),
      avgDiscount: calculateChange(summary.totalAvgDiscountPercent, previousSummary.totalAvgDiscountPercent),
    }
  }, [summary, previousSummary])

  // Format date range for display
  const formatDateRange = () => {
    const start = new Date(dateRange.startDate)
    const end = new Date(dateRange.endDate)
    const formatDate = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${formatDate(start)} – ${formatDate(end)}`
  }

  return (
    <div className="space-y-6">
      {/* Header with period tabs and refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={selectedPeriod} onValueChange={(v) => onPeriodChange(v as PerformancePeriod)}>
          <TabsList>
            {(Object.keys(PERIOD_LABELS) as PerformancePeriod[]).map((period) => (
              <TabsTrigger key={period} value={period}>
                {PERIOD_LABELS[period]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {formatDateRange()}
          </span>
          {cachedAt && (
            <span className="text-sm text-muted-foreground">
              • {fromCache ? 'Cache' : 'Ny'} {cachedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
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

      {/* Info alert about 14-day delay */}
      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Data visas med 14 dagars fördröjning</strong> för att returer ska hinna komma in och ge en rättvisande bild.
          All omsättning och TB visas efter att returer är borträknade.
        </AlertDescription>
      </Alert>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Försäljning"
          value={isLoading ? '' : `${summary?.totalSalesQuantity.toLocaleString('sv-SE')} st`}
          loading={isLoading}
          change={changes?.salesQuantity}
        />
        <KpiCard
          title="Omsättning (netto)"
          value={isLoading ? '' : formatCurrency(summary?.totalTurnover || 0)}
          loading={isLoading}
          change={changes?.turnover}
        />
        <KpiCard
          title="TB"
          value={isLoading ? '' : formatCurrency(summary?.totalTb || 0)}
          loading={isLoading}
          change={changes?.tb}
        />
        <KpiCard
          title="TB%"
          value={isLoading ? '' : `${summary?.totalTbPercent || 0}`}
          suffix="%"
          loading={isLoading}
          change={changes?.tbPercent}
        />
        <KpiCard
          title="Returgrad"
          value={isLoading ? '' : `${summary?.totalReturnRate || 0}`}
          suffix="%"
          loading={isLoading}
          change={changes?.returnRate}
          invertColors
        />
        <KpiCard
          title="Snittrabatt"
          value={isLoading ? '' : `${summary?.totalAvgDiscountPercent || 0}`}
          suffix="%"
          loading={isLoading}
          change={changes?.avgDiscount}
          invertColors
        />
      </div>

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
      <PerformanceTable
        products={filteredProducts}
        isLoading={isLoading}
        onSelectProduct={updateProductParam}
      />

      {/* Detail Sheet */}
      <PerformanceDetailSheet
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={(open) => {
          if (!open) updateProductParam(null)
        }}
        companyId={companyId}
      />
    </div>
  )
}
