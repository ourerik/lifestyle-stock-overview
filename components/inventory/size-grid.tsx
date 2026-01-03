'use client'

import { cn } from '@/lib/utils'
import type { SizeStock } from '@/types/inventory'

interface SizeGridProps {
  sizes: SizeStock[]
  showZettle?: boolean
}

export function SizeGrid({ sizes, showZettle = false }: SizeGridProps) {
  if (sizes.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="px-2 py-1 text-left font-medium">Stl</th>
            {sizes.map(size => (
              <th key={size.size} className="px-2 py-1 text-center font-medium min-w-[40px]">
                {size.size}
              </th>
            ))}
            <th className="px-2 py-1 text-center font-medium border-l">Tot</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-2 py-1 text-muted-foreground">Lager</td>
            {sizes.map(size => (
              <td
                key={size.size}
                className={cn(
                  'px-2 py-1 text-center',
                  size.quantity === 0 && 'text-muted-foreground',
                  size.quantity > 0 && size.quantity < 5 && 'text-amber-600 dark:text-amber-400'
                )}
              >
                {size.quantity}
              </td>
            ))}
            <td className="px-2 py-1 text-center font-medium border-l">
              {sizes.reduce((sum, s) => sum + s.quantity, 0)}
            </td>
          </tr>
          {showZettle && (
            <tr>
              <td className="px-2 py-1 text-muted-foreground">Butik</td>
              {sizes.map(size => (
                <td
                  key={size.size}
                  className={cn(
                    'px-2 py-1 text-center',
                    size.zettleQuantity === 0 && 'text-muted-foreground'
                  )}
                >
                  {size.zettleQuantity}
                </td>
              ))}
              <td className="px-2 py-1 text-center font-medium border-l">
                {sizes.reduce((sum, s) => sum + s.zettleQuantity, 0)}
              </td>
            </tr>
          )}
          {sizes.some(s => s.incoming > 0) && (
            <tr>
              <td className="px-2 py-1 text-muted-foreground">Inkm</td>
              {sizes.map(size => (
                <td
                  key={size.size}
                  className={cn(
                    'px-2 py-1 text-center',
                    size.incoming === 0 && 'text-muted-foreground',
                    size.incoming > 0 && 'text-blue-600 dark:text-blue-400'
                  )}
                >
                  {size.incoming > 0 ? `+${size.incoming}` : '-'}
                </td>
              ))}
              <td className="px-2 py-1 text-center font-medium border-l text-blue-600 dark:text-blue-400">
                +{sizes.reduce((sum, s) => sum + s.incoming, 0)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
