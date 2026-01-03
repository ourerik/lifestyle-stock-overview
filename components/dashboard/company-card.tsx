'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatCurrency, formatPercentChange } from '@/lib/utils/currency';
import type { CompanySummary, ChannelSales } from '@/types';
import { cn } from '@/lib/utils';
import { CompanyLogo } from '@/components/logos';
import { CompanyId } from '@/config/companies';

interface CompanyCardProps {
  summary: CompanySummary;
  loading?: boolean;
}

interface MetricRowProps {
  label: string;
  current: number;
  previous: number;
  format?: 'currency' | 'number';
  suffix?: string;
  small?: boolean;
}

function MetricRow({ label, current, previous, format = 'number', suffix = '', small = false }: MetricRowProps) {
  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const isPositive = percentChange > 0;
  const isNegative = percentChange < 0;
  const isNeutral = percentChange === 0;

  const formattedValue = format === 'currency' ? formatCurrency(current) : `${current.toLocaleString('sv-SE')}${suffix}`;

  return (
    <div className={cn('flex items-center justify-between', small ? 'py-1' : 'py-1.5')}>
      <span className={cn('text-muted-foreground', small ? 'text-xs' : 'text-sm')}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn(small ? 'text-sm' : 'font-medium')}>{formattedValue}</span>
        <div className="flex items-center gap-0.5">
          {isPositive && <TrendingUp className={cn(small ? 'h-2.5 w-2.5' : 'h-3 w-3', 'text-green-600')} />}
          {isNegative && <TrendingDown className={cn(small ? 'h-2.5 w-2.5' : 'h-3 w-3', 'text-red-600')} />}
          {isNeutral && <Minus className={cn(small ? 'h-2.5 w-2.5' : 'h-3 w-3', 'text-muted-foreground')} />}
          <span
            className={cn(
              'font-medium',
              small ? 'text-[10px]' : 'text-xs',
              isPositive && 'text-green-600',
              isNegative && 'text-red-600',
              isNeutral && 'text-muted-foreground'
            )}
          >
            {formatPercentChange(current, previous)}
          </span>
        </div>
      </div>
    </div>
  );
}

function getChannelDisplayName(channel: ChannelSales): string {
  // Extract just the channel type from the label (e.g., "Varg - Webshop" -> "Webshop")
  const parts = channel.label.split(' - ');
  return parts.length > 1 ? parts[1] : channel.label;
}

export function CompanyCard({
  summary,
  loading = false,
}: CompanyCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const { totalSales, b2cAverageOrderValue, channels } = summary;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row justify-end">
        <CompanyLogo companyId={summary.companyId as CompanyId} className="h-5" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary metrics */}
        <div className="divide-y">
          <MetricRow
            label="Försäljning"
            current={totalSales.current.amount}
            previous={totalSales.previous.amount}
            format="currency"
          />
          <MetricRow
            label="Antal kvitton"
            current={totalSales.current.orderCount}
            previous={totalSales.previous.orderCount}
            suffix=" st"
          />
          <MetricRow
            label="Sålda produkter"
            current={totalSales.current.productCount}
            previous={totalSales.previous.productCount}
            suffix=" st"
          />
          <MetricRow
            label="Snittvärde B2C"
            current={b2cAverageOrderValue.current.amount}
            previous={b2cAverageOrderValue.previous.amount}
            format="currency"
          />
        </div>

        {/* Channel breakdown */}
        {channels && channels.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Försäljning per kanal</p>
            <div className="space-y-0.5">
              {channels.map((channel) => (
                <MetricRow
                  key={channel.channel}
                  label={getChannelDisplayName(channel)}
                  current={channel.sales.current.amount}
                  previous={channel.sales.previous.amount}
                  format="currency"
                  small
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
