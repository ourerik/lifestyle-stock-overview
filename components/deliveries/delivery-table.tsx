'use client'

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/types/fifo'
import type { DeliveryListItem, DeliverySortField } from '@/types/delivery'

interface DeliveryTableProps {
  deliveries: DeliveryListItem[]
  sortBy: DeliverySortField
  sortOrder: 'asc' | 'desc'
  onSort: (field: DeliverySortField) => void
}

export function DeliveryTable({
  deliveries,
  sortBy,
  sortOrder,
  onSort,
}: DeliveryTableProps) {
  if (deliveries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Inga leveranser hittades
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            field="createdAt"
            label="Datum"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
            className="w-28"
          />
          <SortableHeader
            field="supplier"
            label="Leverantör"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
          />
          <SortableHeader
            field="productName"
            label="Produkt"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
          />
          <TableHead>Variant</TableHead>
          <TableHead className="w-20">Storlek</TableHead>
          <SortableHeader
            field="quantity"
            label="Antal"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
            className="text-right w-20"
          />
          <SortableHeader
            field="unitCostSEK"
            label="Kr/st"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
            className="text-right w-24"
          />
          <SortableHeader
            field="totalCostSEK"
            label="Total"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
            className="text-right w-28"
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveries.map(delivery => (
          <TableRow key={delivery.id}>
            <TableCell className="text-muted-foreground">
              {new Date(delivery.createdAt).toLocaleDateString('sv-SE')}
            </TableCell>
            <TableCell>{delivery.supplier}</TableCell>
            <TableCell>
              <div>
                <div className="font-medium">{delivery.productName}</div>
                <div className="text-xs text-muted-foreground">
                  {delivery.productNumber}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {delivery.variantName}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {delivery.sizeNumber || '-'}
            </TableCell>
            <TableCell className="text-right font-medium">
              {delivery.quantity}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCurrency(delivery.unitCostSEK)}
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(delivery.totalCostSEK)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface SortableHeaderProps {
  field: DeliverySortField
  label: string
  sortBy: DeliverySortField
  sortOrder: 'asc' | 'desc'
  onSort: (field: DeliverySortField) => void
  className?: string
}

function SortableHeader({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isActive = sortBy === field

  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {isActive ? (
          sortOrder === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </button>
    </TableHead>
  )
}
