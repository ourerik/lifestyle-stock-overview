'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import type { ProductPerformance } from '@/types/performance'

type SortField =
  | 'productName'
  | 'medianCustomerAge'
  | 'salesQuantity'
  | 'returnRate'
  | 'turnover'
  | 'costs'
  | 'tb'
  | 'tbPercent'
  | 'tbWithAds'
  | 'tbPercentWithAds'
  | 'avgDiscountPercent'

interface PerformanceTableProps {
  products: ProductPerformance[]
  isLoading?: boolean
}

export function PerformanceTable({ products, isLoading }: PerformanceTableProps) {
  const [sortBy, setSortBy] = useState<SortField>('turnover')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      // Default to desc for numbers, asc for names
      setSortOrder(field === 'productName' ? 'asc' : 'desc')
    }
  }

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      let aVal: number | string | null = a[sortBy]
      let bVal: number | string | null = b[sortBy]

      // Handle null values for medianCustomerAge
      if (aVal === null) aVal = sortOrder === 'asc' ? Infinity : -Infinity
      if (bVal === null) bVal = sortOrder === 'asc' ? Infinity : -Infinity

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal, 'sv-SE')
          : bVal.localeCompare(aVal, 'sv-SE')
      }

      const numA = aVal as number
      const numB = bVal as number
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })
  }, [products, sortBy, sortOrder])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Inga produkter hittades
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader
              field="productName"
              label="Produkt"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="min-w-[200px]"
            />
            <SortableHeader
              field="medianCustomerAge"
              label="Med. ålder"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-24"
            />
            <SortableHeader
              field="salesQuantity"
              label="Sålt"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-20"
            />
            <SortableHeader
              field="returnRate"
              label="Retur%"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-20"
            />
            <SortableHeader
              field="turnover"
              label="Omsättning"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-28"
            />
            <SortableHeader
              field="costs"
              label="Kostnad"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-24"
            />
            <SortableHeader
              field="tb"
              label="TB"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-24"
            />
            <SortableHeader
              field="tbPercent"
              label="TB%"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-20"
            />
            <SortableHeader
              field="tbWithAds"
              label="TB m. ads"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-24"
            />
            <SortableHeader
              field="tbPercentWithAds"
              label="TB% m. ads"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-24"
            />
            <SortableHeader
              field="avgDiscountPercent"
              label="Rabatt"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right w-20"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProducts.map((product) => (
            <TableRow key={product.productNumber}>
              <TableCell>
                <div>
                  <div className="font-medium">{product.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.productNumber}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {product.medianCustomerAge !== null
                  ? `${product.medianCustomerAge} år`
                  : '-'}
              </TableCell>
              <TableCell className="text-right font-medium">
                {product.salesQuantity.toLocaleString('sv-SE')}
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={
                    product.returnRate > 20
                      ? 'text-destructive font-medium'
                      : product.returnRate > 10
                      ? 'text-yellow-600'
                      : 'text-muted-foreground'
                  }
                >
                  {product.returnRate}%
                </span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(product.turnover)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(product.costs)}
              </TableCell>
              <TableCell className="text-right font-medium">
                <span className={product.tb < 0 ? 'text-destructive' : ''}>
                  {formatCurrency(product.tb)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={
                    product.tbPercent < 0
                      ? 'text-destructive font-medium'
                      : product.tbPercent < 30
                      ? 'text-yellow-600'
                      : 'text-green-600 font-medium'
                  }
                >
                  {product.tbPercent}%
                </span>
              </TableCell>
              <TableCell className="text-right font-medium">
                <span className={product.tbWithAds < 0 ? 'text-destructive' : ''}>
                  {formatCurrency(product.tbWithAds)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={
                    product.tbPercentWithAds < 0
                      ? 'text-destructive font-medium'
                      : product.tbPercentWithAds < 20
                      ? 'text-yellow-600'
                      : 'text-green-600 font-medium'
                  }
                >
                  {product.tbPercentWithAds}%
                </span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {product.avgDiscountPercent > 0
                  ? `${product.avgDiscountPercent}%`
                  : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

interface SortableHeaderProps {
  field: SortField
  label: string
  sortBy: SortField
  sortOrder: 'asc' | 'desc'
  onSort: (field: SortField) => void
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
