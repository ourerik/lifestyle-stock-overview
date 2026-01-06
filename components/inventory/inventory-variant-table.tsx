'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { ChevronRight, ChevronDown, History } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MobileFullBleed } from '@/components/ui/mobile-full-bleed'
import type { AggregatedVariant } from '@/types/inventory'
import type { FifoProductValuation, FifoVariantValuation, FifoSizeValuation } from '@/types/fifo'
import { formatCurrency, formatPeriod, getAgeColorClass, getSourceLabel, getSourceColorClass } from '@/types/fifo'

interface InventoryVariantTableProps {
  variants: AggregatedVariant[]
  showZettle: boolean
  fifoData: FifoProductValuation | null
  productImage?: string | null
  visibleColumns?: string[]
  onHistoryClick: (variant: { variantId: number; variantName: string }) => void
  onImageClick: (image: string) => void
}

export function InventoryVariantTable({
  variants,
  showZettle,
  fifoData,
  productImage,
  visibleColumns,
  onHistoryClick,
  onImageClick,
}: InventoryVariantTableProps) {
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set())

  // Helper to check if a column is visible
  const isColumnVisible = (columnId: string) => {
    if (!visibleColumns) return true
    return visibleColumns.includes(columnId)
  }

  const toggleVariant = (variantId: number) => {
    setExpandedVariants(prev => {
      const next = new Set(prev)
      if (next.has(variantId)) {
        next.delete(variantId)
      } else {
        next.add(variantId)
      }
      return next
    })
  }

  // Get FIFO data for a specific variant
  const getVariantFifo = (variantId: number): FifoVariantValuation | null => {
    if (!fifoData) return null
    return fifoData.variants.find(v => v.variantId === variantId) || null
  }

  // Get FIFO data for a specific size (EAN)
  const getSizeFifo = (ean: string): FifoSizeValuation | null => {
    if (!fifoData) return null
    for (const variant of fifoData.variants) {
      const size = variant.sizes.find(s => s.EAN === ean)
      if (size) return size
    }
    return null
  }

  // Get oldest purchase date from a variant's sizes
  const getVariantOldestDate = (variantId: number): string | null => {
    const variantFifo = getVariantFifo(variantId)
    if (!variantFifo) return null
    let oldest: string | null = null
    for (const size of variantFifo.sizes) {
      if (size.oldestPurchaseDate && (!oldest || size.oldestPurchaseDate < oldest)) {
        oldest = size.oldestPurchaseDate
      }
    }
    return oldest
  }

  if (variants.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Inga varianter hittades
      </div>
    )
  }

  return (
    <MobileFullBleed>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              {isColumnVisible('variant') && <TableHead>Variant</TableHead>}
              {isColumnVisible('quantity') && <TableHead className="text-right">Lager</TableHead>}
              {showZettle && isColumnVisible('zettleQuantity') && <TableHead className="text-right">Butik</TableHead>}
              {isColumnVisible('incoming') && <TableHead className="text-right">Inkommande</TableHead>}
              {isColumnVisible('value') && <TableHead className="text-right">Värde</TableHead>}
              {isColumnVisible('age') && <TableHead className="text-right">I lager</TableHead>}
              {isColumnVisible('history') && <TableHead className="text-right">Historik</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((variant) => {
              const isExpanded = expandedVariants.has(variant.variantId)
              const variantFifo = getVariantFifo(variant.variantId)
              const oldestDate = getVariantOldestDate(variant.variantId)

              // Calculate variant-level location values
              let warehouseVal = 0
              let storeVal = 0
              if (variantFifo) {
                for (const s of variantFifo.sizes) {
                  warehouseVal += s.valueByLocation?.warehouse ?? 0
                  storeVal += s.valueByLocation?.store ?? 0
                }
              }

              return (
                <React.Fragment key={variant.variantId}>
                  <TableRow
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleVariant(variant.variantId)}
                  >
                    <TableCell className="w-8">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    {isColumnVisible('variant') && (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {variant.image && variant.image !== productImage && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onImageClick(variant.image!)
                              }}
                              className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded shrink-0"
                            >
                              <Image
                                src={variant.image}
                                alt={variant.variantName}
                                width={32}
                                height={32}
                                className="rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              />
                            </button>
                          )}
                          <div className="min-w-0">
                            <span className="font-medium text-sm truncate">{variant.variantName}</span>
                            <div className="text-xs text-muted-foreground">{variant.variantNumber}</div>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('quantity') && (
                      <TableCell className="text-right font-medium">
                        {variant.totalQuantity}
                      </TableCell>
                    )}
                    {showZettle && isColumnVisible('zettleQuantity') && (
                      <TableCell className="text-right">
                        {variant.zettleQuantity > 0 ? variant.zettleQuantity : '-'}
                      </TableCell>
                    )}
                    {isColumnVisible('incoming') && (
                      <TableCell className="text-right">
                        {variant.totalIncoming > 0 ? (
                          <span className="text-blue-600 font-medium">+{variant.totalIncoming}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    {isColumnVisible('value') && (
                      <TableCell className="text-right">
                        {variantFifo ? (
                          <div>
                            <div className="font-medium">{formatCurrency(variantFifo.totalValue)}</div>
                            {showZettle && (warehouseVal > 0 || storeVal > 0) && (
                              <div className="text-[10px] text-muted-foreground">
                                {formatCurrency(warehouseVal)} / {formatCurrency(storeVal)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    {isColumnVisible('age') && (
                      <TableCell className="text-right">
                        {variantFifo && oldestDate ? (
                          <span className={getAgeColorClass(variantFifo.maxAgeInDays)}>
                            {formatPeriod(oldestDate)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    {isColumnVisible('history') && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation()
                            onHistoryClick({
                              variantId: variant.variantId,
                              variantName: variant.variantName,
                            })
                          }}
                        >
                          <History className="h-4 w-4" />
                          Visa
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>

                  {/* Expanded content - Size breakdown table */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={100} className="p-0 border-b max-w-0">
                        <SizeBreakdownTable
                            variant={variant}
                            showZettle={showZettle}
                            fifoData={fifoData}
                            getSizeFifo={getSizeFifo}
                          />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </MobileFullBleed>
  )
}

// Size breakdown table shown when a variant is expanded
function SizeBreakdownTable({
  variant,
  showZettle,
  fifoData,
  getSizeFifo,
}: {
  variant: AggregatedVariant
  showZettle: boolean
  fifoData: FifoProductValuation | null
  getSizeFifo: (ean: string) => FifoSizeValuation | null
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/50">
            <TableHead className="w-24 border-r"></TableHead>
            {variant.sizes.map((size, idx) => (
              <TableHead
                key={size.EAN}
                className={`text-center text-xs min-w-[50px] ${idx < variant.sizes.length - 1 ? 'border-r' : ''}`}
              >
                {size.size}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Warehouse stock row */}
          <TableRow className="border-b">
            <TableCell className="text-xs text-muted-foreground border-r">Lager</TableCell>
            {variant.sizes.map((size, idx) => (
              <TableCell
                key={size.EAN}
                className={`text-center text-sm font-semibold ${idx < variant.sizes.length - 1 ? 'border-r' : ''} ${
                  size.quantity === 0
                    ? 'text-muted-foreground'
                    : size.quantity < 2
                      ? 'text-amber-600 dark:text-amber-400'
                      : ''
                }`}
              >
                {size.quantity}
              </TableCell>
            ))}
          </TableRow>

          {/* Zettle/Store stock row */}
          {showZettle && (
            <TableRow className="border-b">
              <TableCell className="text-xs text-muted-foreground border-r">Butik</TableCell>
              {variant.sizes.map((size, idx) => (
                <TableCell
                  key={size.EAN}
                  className={`text-center text-sm ${idx < variant.sizes.length - 1 ? 'border-r' : ''} ${
                    size.zettleQuantity === 0 ? 'text-muted-foreground' : ''
                  }`}
                >
                  {size.zettleQuantity > 0 ? size.zettleQuantity : '-'}
                </TableCell>
              ))}
            </TableRow>
          )}

          {/* Incoming stock row */}
          <TableRow className="border-b">
            <TableCell className="text-xs text-muted-foreground border-r">Inkommande</TableCell>
            {variant.sizes.map((size, idx) => (
              <TableCell key={size.EAN} className={`text-center text-sm ${idx < variant.sizes.length - 1 ? 'border-r' : ''}`}>
                {size.incoming > 0 ? (
                  <span className="text-blue-600 font-medium">+{size.incoming}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            ))}
          </TableRow>

          {/* FIFO Value row */}
          {fifoData && (
            <TableRow className="border-b">
              <TableCell className="text-xs text-muted-foreground border-r">Värde</TableCell>
              {variant.sizes.map((size, idx) => {
                const sizeFifo = getSizeFifo(size.EAN)
                return (
                  <TableCell key={size.EAN} className={`text-center text-xs ${idx < variant.sizes.length - 1 ? 'border-r' : ''}`}>
                    {sizeFifo && sizeFifo.totalValue > 0 ? (
                      <>
                        <div>{formatCurrency(sizeFifo.totalValue)}</div>
                        {showZettle && sizeFifo.valueByLocation && (sizeFifo.valueByLocation.warehouse > 0 || sizeFifo.valueByLocation.store > 0) && (
                          <div className="text-[9px] text-muted-foreground">
                            {formatCurrency(sizeFifo.valueByLocation.warehouse)}/{formatCurrency(sizeFifo.valueByLocation.store)}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          )}

          {/* FIFO oldest date row */}
          {fifoData && (
            <TableRow className="border-b">
              <TableCell className="text-xs text-muted-foreground border-r">I lager</TableCell>
              {variant.sizes.map((size, idx) => {
                const sizeFifo = getSizeFifo(size.EAN)
                return (
                  <TableCell key={size.EAN} className={`text-center text-xs ${idx < variant.sizes.length - 1 ? 'border-r' : ''}`}>
                    {sizeFifo?.oldestPurchaseDate ? (
                      <span className={getAgeColorClass(sizeFifo.maxAgeInDays)}>
                        {formatPeriod(sizeFifo.oldestPurchaseDate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          )}

          {/* FIFO source row - shows data trustworthiness */}
          {fifoData && (
            <TableRow className="border-b">
              <TableCell className="text-xs text-muted-foreground border-r">Källa</TableCell>
              {variant.sizes.map((size, idx) => {
                const sizeFifo = getSizeFifo(size.EAN)
                if (!sizeFifo) {
                  return (
                    <TableCell key={size.EAN} className={`text-center text-xs ${idx < variant.sizes.length - 1 ? 'border-r' : ''}`}>
                      <span className="text-muted-foreground">-</span>
                    </TableCell>
                  )
                }
                return (
                  <TableCell key={size.EAN} className={`text-center text-xs ${idx < variant.sizes.length - 1 ? 'border-r' : ''}`}>
                    <span className={getSourceColorClass(sizeFifo.primarySource)}>
                      {getSourceLabel(sizeFifo.primarySource)}
                    </span>
                    {sizeFifo.quantityBySource.unknown > 0 && (
                      <div className="text-red-500 text-[10px]">
                        ({sizeFifo.quantityBySource.unknown} okänt)
                      </div>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
