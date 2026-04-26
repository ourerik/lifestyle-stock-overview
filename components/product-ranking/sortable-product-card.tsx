'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { ProductRankItem } from '@/types/product-ranking'

interface SortableProductCardProps {
  item: ProductRankItem
  index: number
  showRank: boolean
  onRemove?: () => void
}

export function SortableProductCard({ item, index, showRank, onRemove }: SortableProductCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.displayItemId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary' : ''
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {showRank && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
          {index + 1}
        </span>
      )}

      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            N/A
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.displayName}</div>
        {item.productName !== item.displayName && (
          <div className="truncate text-xs text-muted-foreground">{item.productName}</div>
        )}
      </div>

      {onRemove && (
        <button
          type="button"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={onRemove}
          title="Ta bort från ranking"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
