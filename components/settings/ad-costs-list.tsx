'use client'

import { Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import type { AdCostDocument } from '@/types/ad-costs'

interface AdCostsListProps {
  costs: AdCostDocument[]
  isLoading?: boolean
  onEdit?: (cost: AdCostDocument) => void
  onDelete?: (cost: AdCostDocument) => void
  isDeleting?: string | null // id of cost being deleted
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
]

export function AdCostsList({
  costs,
  isLoading,
  onEdit,
  onDelete,
  isDeleting,
}: AdCostsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (costs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Inga annonskostnader har lagts till ännu.
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Period</TableHead>
            <TableHead className="text-right">Meta</TableHead>
            <TableHead className="text-right">Google</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {costs.map((cost) => (
            <TableRow key={cost.id}>
              <TableCell className="font-medium">
                {MONTH_NAMES[cost.month - 1]} {cost.year}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {cost.metaCost.toLocaleString('sv-SE')} kr
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {cost.googleCost.toLocaleString('sv-SE')} kr
              </TableCell>
              <TableCell className="text-right font-medium">
                {cost.totalCost.toLocaleString('sv-SE')} kr
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(cost)}
                      title="Redigera"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(cost)}
                      disabled={isDeleting === cost.id}
                      title="Ta bort"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
