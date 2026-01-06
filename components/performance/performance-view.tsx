'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { RefreshCw, AlertCircle, Info, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { KpiCard } from '@/components/ui/kpi-card'
import { DataTable, type Column, type ColumnConfig } from '@/components/ui/data-table'
import { TableToolbar } from '@/components/ui/table-toolbar'
import { useColumnVisibility } from '@/hooks/use-column-visibility'
import { PerformanceDetailSheet } from './performance-detail-sheet'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateRangeShort } from '@/lib/utils/date'
import type { CompanyId } from '@/config/companies'
import type { PerformanceData, ProductPerformance } from '@/types/performance'
import type { PerformancePeriod } from './performance-page-view'

const PERIOD_LABELS: Record<PerformancePeriod, string> = {
  '1y': '12 mån',
  '9m': '9 mån',
  '6m': '6 mån',
  '3m': '3 mån',
  '1m': '1 mån',
}

const PERIOD_TO_MONTHS: Record<PerformancePeriod, number> = {
  '1y': 12,
  '9m': 9,
  '6m': 6,
  '3m': 3,
  '1m': 1,
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

// Column definitions for DataTable
const columns: Column<ProductPerformance>[] = [
  {
    id: 'productName',
    label: 'Produkt',
    accessor: (row) => (
      <div>
        <div className="font-medium">{row.productName}</div>
        <div className="text-xs text-muted-foreground">{row.productNumber}</div>
      </div>
    ),
    sortable: true,
    width: 'max-w-[200px] md:max-w-none md:min-w-[200px]',
  },
  {
    id: 'medianCustomerAge',
    label: 'Kund',
    accessor: 'medianCustomerAge',
    sortable: true,
    align: 'right',
    width: 'w-24',
    renderCell: (value) => (
      <span className="text-muted-foreground">
        {value !== null ? `${value} år` : '-'}
      </span>
    ),
  },
  {
    id: 'salesQuantity',
    label: 'Sålt',
    accessor: 'salesQuantity',
    sortable: true,
    align: 'right',
    format: 'number',
    width: 'w-20',
  },
  {
    id: 'returnRate',
    label: 'Retur%',
    accessor: 'returnRate',
    sortable: true,
    align: 'right',
    width: 'w-20',
    colorCode: (value) =>
      value > 20 ? 'danger' : value > 10 ? 'warning' : 'default',
    renderCell: (value, row) => (
      <span
        className={
          row.returnRate > 20
            ? 'text-destructive font-medium'
            : row.returnRate > 10
            ? 'text-yellow-600'
            : 'text-muted-foreground'
        }
      >
        {value}%
      </span>
    ),
  },
  {
    id: 'turnover',
    label: 'Omsättning',
    accessor: 'turnover',
    sortable: true,
    align: 'right',
    format: 'currency',
    width: 'w-28',
  },
  {
    id: 'costs',
    label: 'Kostnad',
    accessor: 'costs',
    sortable: true,
    align: 'right',
    format: 'currency',
    width: 'w-24',
    renderCell: (value) => (
      <span className="text-muted-foreground">{formatCurrency(value)}</span>
    ),
  },
  {
    id: 'tb',
    label: 'TB',
    accessor: 'tb',
    sortable: true,
    align: 'right',
    width: 'w-24',
    renderCell: (value) => (
      <span className={value < 0 ? 'text-destructive font-medium' : 'font-medium'}>
        {formatCurrency(value)}
      </span>
    ),
  },
  {
    id: 'tbPercent',
    label: 'TB%',
    accessor: 'tbPercent',
    sortable: true,
    align: 'right',
    width: 'w-20',
    renderCell: (value) => (
      <span
        className={
          value < 0
            ? 'text-destructive font-medium'
            : value < 30
            ? 'text-yellow-600'
            : 'text-green-600 font-medium'
        }
      >
        {value}%
      </span>
    ),
  },
  {
    id: 'avgDiscountPercent',
    label: 'Rabatt',
    accessor: 'avgDiscountPercent',
    sortable: true,
    align: 'right',
    width: 'w-20',
    renderCell: (value) => (
      <span className="text-muted-foreground">
        {value > 0 ? `${value}%` : '-'}
      </span>
    ),
  },
]

// Column configs for visibility hook
const columnConfigs: ColumnConfig[] = columns.map((col) => ({
  id: col.id,
  label: col.label,
  defaultVisible: col.defaultVisible !== false,
}))

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

  // Column visibility
  const { visibleColumns, toggleColumn, resetToDefaults } = useColumnVisibility(
    'performance-products',
    columnConfigs
  )

  // Get selected product from URL
  const productParam = searchParams.get('product')

  // Find selected product by productNumber
  const selectedProduct = useMemo(() => {
    if (!productParam || !data) return null
    return data.products.find(p => p.productNumber === productParam) || null
  }, [productParam, data])

  // Find previous period's product for comparison
  const previousProduct = useMemo(() => {
    if (!productParam || !previousData) return null
    return previousData.products.find(p => p.productNumber === productParam) || null
  }, [productParam, previousData])

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

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // Format date range for display
  const formatDateRange = () => {
    const start = new Date(dateRange.startDate)
    const end = new Date(dateRange.endDate)
    const formatDate = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${formatDate(start)} – ${formatDate(end)}`
  }


  return (
    <div className="space-y-6">
      {/* Mobile header - compact button group */}
      <div className="flex md:hidden">
        <div className="flex w-full rounded-md border bg-background">
          {/* Period dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex-1 justify-between rounded-r-none h-9 bg-muted hover:bg-muted/80">
                {PERIOD_LABELS[selectedPeriod]}
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(Object.keys(PERIOD_LABELS) as PerformancePeriod[]).map((period) => (
                <DropdownMenuItem
                  key={period}
                  onClick={() => onPeriodChange(period)}
                  className={selectedPeriod === period ? 'bg-accent' : ''}
                >
                  {PERIOD_LABELS[period]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date range */}
          <span className="px-3 text-xs text-muted-foreground flex items-center border-l border-r">
            {formatDateRangeShort(dateRange)}
          </span>

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {/* Info button */}
          <div className="border-l flex items-center self-stretch">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-l-none h-9 px-3">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Om datan</DialogTitle>
                <DialogDescription>
                  <strong>Data visas med 14 dagars fördröjning</strong> för att returer ska hinna komma in och ge en rättvisande bild.
                  All omsättning och TB visas efter att returer är borträknade.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Desktop header - tabs and info */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-4">
        <Tabs value={selectedPeriod} onValueChange={(v) => onPeriodChange(v as PerformancePeriod)}>
          <TabsList>
            {(Object.keys(PERIOD_LABELS) as PerformancePeriod[]).map((period) => (
              <TabsTrigger key={period} value={period}>
                {PERIOD_LABELS[period]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex rounded-md border bg-background">
          <span className="px-3 text-sm text-muted-foreground flex items-center border-r">
            {formatDateRange()}
            {cachedAt && (
              <span className="ml-2">
                • {fromCache ? 'Cache' : 'Ny'} {cachedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-none"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
          <div className="border-l flex items-center">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-3 rounded-l-none">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Om datan</DialogTitle>
                  <DialogDescription>
                    <strong>Data visas med 14 dagars fördröjning</strong> för att returer ska hinna komma in och ge en rättvisande bild.
                    All omsättning och TB visas efter att returer är borträknade.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-3 md:mb-6 md:mx-0 md:px-0 md:grid md:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 md:overflow-visible md:pb-0">
        <KpiCard
          title="Försäljning"
          value={summary?.totalSalesQuantity || 0}
          suffix="st"
          format="number"
          loading={isLoading}
          change={changes?.salesQuantity}
          comparisonLabel="vs förra året"
        />
        <KpiCard
          title="Omsättning (netto)"
          value={summary?.totalTurnover || 0}
          format="currency"
          loading={isLoading}
          change={changes?.turnover}
          comparisonLabel="vs förra året"
        />
        <KpiCard
          title="TB"
          value={summary?.totalTb || 0}
          format="currency"
          loading={isLoading}
          change={changes?.tb}
          comparisonLabel="vs förra året"
        />
        <KpiCard
          title="TB%"
          value={summary?.totalTbPercent || 0}
          suffix="%"
          loading={isLoading}
          change={changes?.tbPercent}
          comparisonLabel="vs förra året"
        />
        <KpiCard
          title="Returgrad"
          value={summary?.totalReturnRate || 0}
          suffix="%"
          loading={isLoading}
          change={changes?.returnRate}
          invertColors
          comparisonLabel="vs förra året"
        />
        <KpiCard
          title="Snittrabatt"
          value={summary?.totalAvgDiscountPercent || 0}
          suffix="%"
          loading={isLoading}
          change={changes?.avgDiscount}
          invertColors
          comparisonLabel="vs förra året"
        />
      </div>

      {/* Toolbar */}
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Sök produkt..."
        columnConfigs={columnConfigs}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        onResetColumns={resetToDefaults}
      />

      {/* Table - full bleed on mobile */}
      <DataTable
        data={filteredProducts}
        columns={columns}
        tableId="performance-products"
        loading={isLoading}
        onRowClick={updateProductParam}
        rowKey="productNumber"
        defaultSortField="turnover"
        defaultSortOrder="desc"
        emptyMessage="Inga produkter hittades"
        hideColumnSelector
        visibleColumns={visibleColumns}
        mobileFullBleed
      />

      {/* Detail Sheet */}
      <PerformanceDetailSheet
        product={selectedProduct}
        previousProduct={previousProduct}
        open={!!selectedProduct}
        onOpenChange={(open) => {
          if (!open) updateProductParam(null)
        }}
        companyId={companyId}
        dateRange={dateRange}
        periodMonths={PERIOD_TO_MONTHS[selectedPeriod]}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
    </div>
  )
}
