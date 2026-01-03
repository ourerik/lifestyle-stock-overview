'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercentChange } from '@/lib/utils/currency';
import type { ChannelSales } from '@/types';
import { cn } from '@/lib/utils';

interface ChannelBreakdownProps {
  channels: ChannelSales[];
  loading?: boolean;
}

export function ChannelBreakdown({ channels, loading = false }: ChannelBreakdownProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Försäljning per kanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (channels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Försäljning per kanal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Ingen kanaldata tillgänglig</p>
        </CardContent>
      </Card>
    );
  }

  // Sort channels by current amount (highest first)
  const sortedChannels = [...channels].sort(
    (a, b) => b.sales.current.amount - a.sales.current.amount
  );

  // Calculate total for percentage
  const total = sortedChannels.reduce((sum, ch) => sum + ch.sales.current.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Försäljning per kanal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedChannels.map((channel) => {
            const { sales, returns, label } = channel;
            const percentage = total > 0 ? (sales.current.amount / total) * 100 : 0;
            const isPositive = sales.percentChange > 0;
            const isNegative = sales.percentChange < 0;

            return (
              <div key={channel.channel} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{label}</span>
                    <span className="text-sm text-muted-foreground">
                      ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {formatCurrency(sales.current.amount)}
                    </span>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-sm',
                        isPositive && 'text-green-600',
                        isNegative && 'text-red-600',
                        !isPositive && !isNegative && 'text-muted-foreground'
                      )}
                    >
                      {isPositive && <TrendingUp className="h-3 w-3" />}
                      {isNegative && <TrendingDown className="h-3 w-3" />}
                      {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
                      {formatPercentChange(sales.current.amount, sales.previous.amount)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Returns if tracked */}
                {returns && returns.current.orderCount > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Returer</span>
                    <span className="text-red-600">
                      {formatCurrency(returns.current.amount)} ({returns.current.orderCount} st)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
