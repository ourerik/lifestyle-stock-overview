'use client'

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProductRow } from './product-row'
import type { AggregatedProduct } from '@/types/inventory'

interface InventoryTableProps {
  products: AggregatedProduct[]
  showZettle?: boolean
  onSelectProduct?: (product: AggregatedProduct) => void
}

export function InventoryTable({
  products,
  showZettle = false,
  onSelectProduct,
}: InventoryTableProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Inga produkter hittades
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead className="text-right w-24">Lager</TableHead>
          {showZettle && <TableHead className="text-right w-24">Butik</TableHead>}
          <TableHead className="text-right w-24">Inkommande</TableHead>
          <TableHead className="w-40">Status</TableHead>
          <TableHead className="w-8"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map(product => (
          <ProductRow
            key={product.productNumber}
            product={product}
            showZettle={showZettle}
            onSelect={onSelectProduct}
          />
        ))}
      </TableBody>
    </Table>
  )
}
