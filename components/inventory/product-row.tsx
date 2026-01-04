'use client'

import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { TableCell, TableRow } from '@/components/ui/table'
import { StatusBadges } from './status-badge'
import { formatCurrency } from '@/types/fifo'
import type { AggregatedProduct } from '@/types/inventory'

interface ProductRowProps {
  product: AggregatedProduct
  showZettle?: boolean
  onSelect?: (product: AggregatedProduct) => void
}

export function ProductRow({ product, showZettle = false, onSelect }: ProductRowProps) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onSelect?.(product)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.productName}
              width={40}
              height={40}
              className="rounded object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
              N/A
            </div>
          )}
          <div>
            <div className="font-medium">{product.productName}</div>
            <div className="text-xs text-muted-foreground">{product.productNumber}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right font-medium">{product.totalQuantity}</TableCell>
      {showZettle && (
        <TableCell className="text-right font-medium">{product.totalZettleQuantity}</TableCell>
      )}
      <TableCell className="text-right">
        {product.totalIncoming > 0 ? (
          <span className="text-blue-600 dark:text-blue-400 font-medium">
            +{product.totalIncoming}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {product.fifoValue != null ? (
          <span className="font-medium">{formatCurrency(product.fifoValue)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {product.fifoCost != null ? (
          <span className="text-muted-foreground">{formatCurrency(product.fifoCost)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <StatusBadges statuses={product.status} />
      </TableCell>
      <TableCell className="w-8">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  )
}
