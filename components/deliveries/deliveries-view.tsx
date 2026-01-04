'use client'

import { useMemo } from 'react'
import { Package, AlertTriangle, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { DeliveryTable } from './delivery-table'
import { formatCurrency } from '@/types/fifo'
import type { DeliveriesResponse, DeliverySortField } from '@/types/delivery'

interface DeliveriesViewProps {
  data: DeliveriesResponse | null
  isLoading: boolean
  error: string | null
  page: number
  pageSize: number
  sortBy: DeliverySortField
  sortOrder: 'asc' | 'desc'
  onSort: (field: DeliverySortField) => void
  onPageChange: (page: number) => void
}

export function DeliveriesView({
  data,
  isLoading,
  error,
  page,
  pageSize,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
}: DeliveriesViewProps) {
  // Calculate summary values
  const summary = useMemo(() => {
    if (!data) return null

    const totalQuantity = data.deliveries.reduce((sum, d) => sum + d.quantity, 0)
    const totalValue = data.deliveries.reduce((sum, d) => sum + d.totalCostSEK, 0)

    return {
      totalDeliveries: data.total,
      totalQuantity,
      totalValue,
    }
  }, [data])

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Kunde inte hämta leveranser</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Totalt antal rader"
          value={summary?.totalDeliveries}
          subtitle="inleveransrader"
          icon={Package}
          isLoading={isLoading}
        />
        <SummaryCard
          title="Totalt antal enheter"
          value={summary?.totalQuantity}
          subtitle="på denna sida"
          icon={TrendingUp}
          isLoading={isLoading}
        />
        <SummaryCard
          title="Totalt värde"
          value={summary?.totalValue}
          subtitle="på denna sida (SEK)"
          icon={TrendingUp}
          isLoading={isLoading}
          formatAsCurrency
        />
      </div>

      {/* Deliveries table */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <DeliveryTable
            deliveries={data?.deliveries || []}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
          />
        </div>
      )}

      {/* Pagination */}
      {!isLoading && data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Visar {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.total)} av{' '}
            {data.total} rader
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
            >
              Föregående
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Nästa
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface SummaryCardProps {
  title: string
  value: number | undefined
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  isLoading: boolean
  formatAsCurrency?: boolean
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  isLoading,
  formatAsCurrency = false,
}: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <p className="text-2xl font-bold">
                {value != null
                  ? formatAsCurrency
                    ? formatCurrency(value)
                    : value.toLocaleString('sv-SE')
                  : '-'}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}
