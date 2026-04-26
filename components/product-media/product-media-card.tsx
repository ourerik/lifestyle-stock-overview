'use client'

import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProductMediaItem } from '@/types/product-media'

interface ProductMediaCardProps {
  item: ProductMediaItem
  onClick: () => void
}

export function ProductMediaCard({ item, onClick }: ProductMediaCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.displayName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {item.productNumber ? `${item.productNumber} · ` : ''}
            {item.productName}
          </div>
        </div>
        {item.generatedCount > 0 && (
          <Badge variant="secondary" className="shrink-0 gap-1">
            <Sparkles className="h-3 w-3" />
            {item.generatedCount}
          </Badge>
        )}
      </div>

      {item.images.length === 0 ? (
        <div className="flex h-20 w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">
          Inga bilder
        </div>
      ) : (
        <div className="flex gap-1.5 overflow-hidden">
          {item.images.slice(0, 6).map((url, i) => (
            <div
              key={`${url}-${i}`}
              className={cn(
                'relative h-16 shrink-0 overflow-hidden rounded bg-muted',
                i === 0 ? 'w-24' : 'w-16',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
          {item.images.length > 6 && (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
              +{item.images.length - 6}
            </div>
          )}
        </div>
      )}

      {item.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.categories.slice(0, 3).map((cat) => (
            <Badge key={cat} variant="outline" className="text-[10px]">
              {cat}
            </Badge>
          ))}
          {item.categories.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{item.categories.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  )
}
