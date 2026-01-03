'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercentChange } from '@/lib/utils/currency';
import type { SalesOverview } from '@/types';
import { cn } from '@/lib/utils';

interface SalesCardProps {
  title: string;
  data?: SalesOverview;
  loading?: boolean;
  showOrders?: boolean;
  comparisonLabel?: string;
}

export function SalesCard({
  title,
  data,
  loading = false,
  showOrders = false,
  comparisonLabel = 'vs föregående',
}: SalesCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-16 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">--</p>
          <p className="text-sm text-muted-foreground">Ingen data</p>
        </CardContent>
      </Card>
    );
  }

  const { current, previous, percentChange } = data;
  const isPositive = percentChange > 0;
  const isNegative = percentChange < 0;
  const isNeutral = percentChange === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{formatCurrency(current.amount)}</p>
        <div className="mt-1 flex items-center gap-1">
          {isPositive && <TrendingUp className="h-4 w-4 text-green-600" />}
          {isNegative && <TrendingDown className="h-4 w-4 text-red-600" />}
          {isNeutral && <Minus className="h-4 w-4 text-muted-foreground" />}
          <span
            className={cn(
              'text-sm font-medium',
              isPositive && 'text-green-600',
              isNegative && 'text-red-600',
              isNeutral && 'text-muted-foreground'
            )}
          >
            {formatPercentChange(current.amount, previous.amount)}
          </span>
          <span className="text-sm text-muted-foreground">{comparisonLabel}</span>
        </div>
        {showOrders && (
          <p className="mt-1 text-sm text-muted-foreground">
            {current.orderCount} ordrar ({previous.orderCount} föregående)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
