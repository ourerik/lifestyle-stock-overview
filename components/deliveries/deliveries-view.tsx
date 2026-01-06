'use client'

import { useMemo } from 'react'
import { Package, AlertTriangle, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { formatCurrency } from '@/types/fifo'
import type { DeliveriesResponse, DeliveryListItem, DeliverySortField } from '@/types/delivery'

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

  // Column definitions for DataTable
  const columns: Column<DeliveryListItem>[] = useMemo(() => [
    {
      id: 'createdAt',
      label: 'Datum',
      accessor: 'createdAt',
      sortable: true,
      width: 'w-28',
      renderCell: (value) => (
        <span className="text-muted-foreground">
          {new Date(value).toLocaleDateString('sv-SE')}
        </span>
      ),
    },
    {
      id: 'supplier',
      label: 'Leverantör',
      accessor: 'supplier',
      sortable: true,
    },
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
    },
    {
      id: 'variantName',
      label: 'Variant',
      accessor: 'variantName',
      sortable: false,
      renderCell: (value) => <span className="text-muted-foreground">{value}</span>,
    },
    {
      id: 'sizeNumber',
      label: 'Storlek',
      accessor: 'sizeNumber',
      sortable: false,
      width: 'w-20',
      renderCell: (value) => <span className="text-muted-foreground">{value || '-'}</span>,
    },
    {
      id: 'quantity',
      label: 'Antal',
      accessor: 'quantity',
      sortable: true,
      align: 'right',
      format: 'number',
      width: 'w-20',
    },
    {
      id: 'unitCostSEK',
      label: 'Kr/st',
      accessor: 'unitCostSEK',
      sortable: true,
      align: 'right',
      width: 'w-24',
      renderCell: (value) => (
        <span className="text-muted-foreground">{formatCurrency(value)}</span>
      ),
    },
    {
      id: 'totalCostSEK',
      label: 'Total',
      accessor: 'totalCostSEK',
      sortable: true,
      align: 'right',
      width: 'w-28',
      renderCell: (value) => (
        <span className="font-medium">{formatCurrency(value)}</span>
      ),
    },
  ], [])

  // Handle sort from DataTable
  const handleSort = (field: string) => {
    onSort(field as DeliverySortField)
  }

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
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:gap-4 md:grid-cols-3 md:overflow-visible md:pb-0">
        <KpiCard
          title="Leveransrader"
          value={summary?.totalDeliveries ?? 0}
          format="number"
          subtitle="totalt antal rader"
          icon={Package}
          loading={isLoading}
        />
        <KpiCard
          title="Antal enheter"
          value={summary?.totalQuantity ?? 0}
          suffix="st"
          format="number"
          subtitle="på denna sida"
          icon={TrendingUp}
          loading={isLoading}
        />
        <KpiCard
          title="Totalt värde"
          value={summary?.totalValue ?? 0}
          format="currency"
          subtitle="på denna sida"
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Deliveries table */}
      <DataTable<DeliveryListItem>
        data={data?.deliveries || []}
        columns={columns}
        tableId="deliveries"
        loading={isLoading}
        emptyMessage="Inga leveranser hittades"
        rowKey="id"
        showColumnSelector={true}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        mobileFullBleed
      />

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

