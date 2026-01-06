'use client'

import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: number | null // % change vs previous period
  suffix?: string // e.g. "%" or "st"
  icon?: LucideIcon
  loading?: boolean
  invertColors?: boolean // for metrics where lower is better
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'warning' | 'info'
  format?: 'number' | 'currency' | 'none'
  comparisonLabel?: string // e.g. "vs förra året"
  className?: string
}

const sizeStyles = {
  sm: {
    title: 'text-[12px] md:text-xs',
    value: 'text-sm md:text-base',
    change: 'text-[12px] md:text-xs',
    icon: 'h-6 w-6',
    iconWrapper: 'h-8 w-8',
    suffix: 'text-xs md:text-sm',
    skeleton: { value: 'h-5 w-16', change: 'h-3 w-12' },
  },
  md: {
    title: 'text-[10px] md:text-sm',
    value: 'text-base md:text-xl',
    change: 'text-[10px] md:text-xs',
    icon: 'h-7 w-7',
    iconWrapper: 'h-10 w-10',
    suffix: 'text-sm md:text-base',
    skeleton: { value: 'h-7 w-20', change: 'h-4 w-14' },
  },
  lg: {
    title: 'text-xs md:text-sm',
    value: 'text-lg md:text-2xl',
    change: 'text-[10px] md:text-sm',
    icon: 'h-8 w-8',
    iconWrapper: 'h-12 w-12',
    suffix: 'text-base md:text-lg',
    skeleton: { value: 'h-8 w-24', change: 'h-4 w-16' },
  },
}

const variantStyles = {
  default: {
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
  warning: {
    iconBg: 'bg-amber-100 dark:bg-amber-950',
    iconColor: 'text-amber-500',
  },
  info: {
    iconBg: 'bg-blue-100 dark:bg-blue-950',
    iconColor: 'text-blue-500',
  },
}

function formatValue(
  value: string | number,
  format: 'number' | 'currency' | 'none'
): string {
  if (typeof value === 'string') return value
  if (format === 'currency') return formatCurrency(value)
  if (format === 'number') return value.toLocaleString('sv-SE')
  return String(value)
}

export function KpiCard({
  title,
  value,
  subtitle,
  change,
  suffix,
  icon: Icon,
  loading = false,
  invertColors = false,
  size = 'md',
  variant = 'default',
  format = 'none',
  comparisonLabel,
  className,
}: KpiCardProps) {
  const styles = sizeStyles[size]
  const variantStyle = variantStyles[variant]

  // Determine change colors
  const isPositive = change !== null && change !== undefined && change > 0
  const isNegative = change !== null && change !== undefined && change < 0

  const getChangeColorClass = () => {
    if (change === null || change === undefined || change === 0) {
      return 'text-muted-foreground'
    }
    if (invertColors) {
      return isPositive ? 'text-red-600' : 'text-green-600'
    }
    return isPositive ? 'text-green-600' : 'text-red-600'
  }

  const changeColorClass = getChangeColorClass()

  if (loading) {
    return (
      <Card
        className={cn(
          'min-w-[130px] flex-shrink-0 md:min-w-0 !py-0 bg-muted/50 !rounded mt-px',
          className
        )}
      >
        <CardContent className="pt-3 pr-3 pb-2 pl-2 md:pt-6 md:px-6 md:pb-6 h-full flex flex-col justify-end">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className={cn('font-medium text-muted-foreground', styles.title)}>
                {title}
              </p>
              <Skeleton className={styles.skeleton.value} />
              <Skeleton className={styles.skeleton.change} />
            </div>
            {Icon && (
              <Skeleton className={cn('rounded-full', styles.iconWrapper)} />
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const formattedValue = formatValue(value, format)

  return (
    <Card
      className={cn(
        'min-w-[130px] flex-shrink-0 md:min-w-0 md:flex-shrink !py-0 bg-muted/50 !rounded mt-px',
        className
      )}
    >
      <CardContent className="pt-6 pr-3 pb-2.5 pl-2.5 md:pt-6 md:px-6 md:pb-6">
        <div className="flex items-end justify-between">
          <div className="space-y-0 md:space-y-0.5 leading-tight">
            <p className={cn('font-medium text-muted-foreground', styles.title)}>
              {title}
            </p>
            <p className={cn('font-bold', styles.value)}>
              {formattedValue}
              {suffix && (
                <span
                  className={cn(
                    'font-normal text-muted-foreground ml-0.5',
                    styles.suffix
                  )}
                >
                  {suffix}
                </span>
              )}
            </p>
            {change !== null && change !== undefined && (
              <div className={cn('flex items-center gap-0.5 md:gap-1', styles.change, changeColorClass)}>
                {isPositive ? (
                  <TrendingUp className="h-2.5 w-2.5 md:h-3 md:w-3" />
                ) : isNegative ? (
                  <TrendingDown className="h-2.5 w-2.5 md:h-3 md:w-3" />
                ) : null}
                <span>
                  {isPositive ? '+' : ''}
                  {change}%
                  {comparisonLabel && (
                    <span className="hidden md:inline text-muted-foreground ml-1">
                      {comparisonLabel}
                    </span>
                  )}
                </span>
              </div>
            )}
            {subtitle && (
              <p className={cn('text-muted-foreground', styles.change)}>
                {subtitle}
              </p>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                'rounded-full flex items-center justify-center',
                styles.iconWrapper,
                variantStyle.iconBg
              )}
            >
              <Icon className={cn(styles.icon, variantStyle.iconColor)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
