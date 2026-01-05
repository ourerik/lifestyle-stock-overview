'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Calendar, TrendingUp } from 'lucide-react'
import type { CompanyId } from '@/config/companies'
import type { VariantPurchaseHistory } from '@/types/purchase-history'
import { formatCurrency, formatPeriod } from '@/types/fifo'

interface PurchaseHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variantId: number
  variantName: string
  productNumber: string
  companyId: Exclude<CompanyId, 'all'>
}

export function PurchaseHistoryDialog({
  open,
  onOpenChange,
  variantId,
  variantName,
  productNumber,
  companyId,
}: PurchaseHistoryDialogProps) {
  const [data, setData] = useState<VariantPurchaseHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setData(null)
      setError(null)
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/inventory/purchase-history?company=${companyId}&productNumber=${encodeURIComponent(productNumber)}`
        )

        if (!res.ok) {
          throw new Error('Failed to fetch purchase history')
        }

        const json = await res.json()
        const variant = json.data?.variants?.find(
          (v: VariantPurchaseHistory) => v.variantId === variantId
        )

        setData(variant || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [open, variantId, productNumber, companyId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inköpshistorik - {variantName}
          </DialogTitle>
          <DialogDescription>
            Alla leveranser för denna variant, grupperat per storlek
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-destructive">
            <p>Kunde inte ladda inköpshistorik</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {data.sizes.map((size) => (
              <div key={size.sizeNumber} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    Storlek {size.sizeNumber || '-'}
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    Nu i lager: <span className="font-medium text-foreground">{size.currentStock} st</span>
                  </span>
                </div>

                {size.deliveries.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Datum</TableHead>
                        <TableHead className="text-right">Antal</TableHead>
                        <TableHead>Leverantör</TableHead>
                        <TableHead className="text-right">Pris/st</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {size.deliveries.map((delivery, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {formatPeriod(delivery.date)}
                          </TableCell>
                          <TableCell className="text-right">
                            {delivery.quantity} st
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {delivery.supplierName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(delivery.unitCostSEK)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    Inga leveranser registrerade
                  </p>
                )}
              </div>
            ))}

            {/* Summary footer */}
            <div className="border-t pt-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Totalt inköpt:</span>
                  <span className="font-medium">{data.totalQuantityPurchased} st</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Nu i lager:</span>
                  <span className="font-medium">{data.currentStock} st</span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Första inköpet:</span>
                  <span className="font-medium">
                    {data.firstPurchaseDate ? formatPeriod(data.firstPurchaseDate) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Ingen inköpshistorik hittades</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
