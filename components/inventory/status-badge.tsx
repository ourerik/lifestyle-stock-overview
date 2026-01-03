'use client'

import { Badge } from '@/components/ui/badge'
import type { ProductStatus } from '@/types/inventory'

interface StatusBadgeProps {
  status: ProductStatus
}

const statusConfig: Record<ProductStatus, { label: string; className: string }> = {
  low: {
    label: 'Lågt lager',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  incoming: {
    label: 'Inkommande',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  discontinued: {
    label: 'Utgående',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}

interface StatusBadgesProps {
  statuses: ProductStatus[]
}

export function StatusBadges({ statuses }: StatusBadgesProps) {
  if (statuses.length === 0) return null

  return (
    <div className="flex gap-1 flex-wrap">
      {statuses.map(status => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  )
}
