'use client'

import Image from 'next/image'
import { SizeGrid } from './size-grid'
import type { AggregatedVariant } from '@/types/inventory'

interface VariantRowProps {
  variant: AggregatedVariant
  showZettle?: boolean
}

export function VariantRow({ variant, showZettle = false }: VariantRowProps) {
  return (
    <div className="flex gap-4 py-3 px-4 bg-muted/30 border-t first:border-t-0">
      {/* Variant image */}
      <div className="flex-shrink-0">
        {variant.image ? (
          <Image
            src={variant.image}
            alt={variant.variantName}
            width={48}
            height={48}
            className="rounded object-cover"
          />
        ) : (
          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
            N/A
          </div>
        )}
      </div>

      {/* Variant info and sizes */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-sm">{variant.variantName}</span>
          <span className="text-xs text-muted-foreground">({variant.variantNumber})</span>
        </div>
        <SizeGrid sizes={variant.sizes} showZettle={showZettle} />
      </div>

      {/* Totals */}
      <div className="flex-shrink-0 text-right text-sm">
        <div>
          <span className="text-muted-foreground">Lager: </span>
          <span className="font-medium">{variant.totalQuantity}</span>
        </div>
        {showZettle && variant.zettleQuantity > 0 && (
          <div>
            <span className="text-muted-foreground">Butik: </span>
            <span className="font-medium">{variant.zettleQuantity}</span>
          </div>
        )}
        {variant.totalIncoming > 0 && (
          <div className="text-blue-600 dark:text-blue-400">
            <span className="text-muted-foreground">Inkm: </span>
            <span className="font-medium">+{variant.totalIncoming}</span>
          </div>
        )}
      </div>
    </div>
  )
}
