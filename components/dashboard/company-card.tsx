'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatCurrency, formatPercentChange } from '@/lib/utils/currency';
import type { CompanySummary, ChannelSales, TimeSlotChartData } from '@/types';
import { cn } from '@/lib/utils';
import { CompanyLogo } from '@/components/logos';
import { CompanyId } from '@/config/companies';
import { usePeriod } from '@/providers/period-provider';
import { TimeSlotChart } from './time-slot-chart';

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
  invertTrend?: boolean; // When true, positive change shows red, negative shows green
}

function MetricRow({ label, current, previous, format = 'number', suffix = '', small = false, invertTrend = false }: MetricRowProps) {
  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const isPositive = percentChange > 0;
  const isNegative = percentChange < 0;
  const isNeutral = percentChange === 0;

  // When invertTrend is true, swap the colors (positive = bad, negative = good)
  const positiveColor = invertTrend ? 'text-red-600' : 'text-green-600';
  const negativeColor = invertTrend ? 'text-green-600' : 'text-red-600';

  const formattedValue = format === 'currency' ? formatCurrency(current) : `${current.toLocaleString('sv-SE')}${suffix}`;

  return (
    <div className={cn('flex items-center justify-between', small ? 'py-1' : 'py-1.5')}>
      <span className={cn('text-muted-foreground', small ? 'text-xs' : 'text-sm')}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn(small ? 'text-sm' : 'font-medium')}>{formattedValue}</span>
        <div className="flex items-center gap-0.5">
          {isPositive && <TrendingUp className={cn(small ? 'h-2.5 w-2.5' : 'h-3 w-3', positiveColor)} />}
          {isNegative && <TrendingDown className={cn(small ? 'h-2.5 w-2.5' : 'h-3 w-3', negativeColor)} />}
          {isNeutral && <Minus className={cn(small ? 'h-2.5 w-2.5' : 'h-3 w-3', 'text-muted-foreground')} />}
          <span
            className={cn(
              'font-medium',
              small ? 'text-[10px]' : 'text-xs',
              isPositive && positiveColor,
              isNegative && negativeColor,
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
  const { currentPeriod } = usePeriod();
  const [timeSlotData, setTimeSlotData] = useState<TimeSlotChartData | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  // Fetch time-slot data when period is 'last-7-days'
  const fetchTimeSlots = useCallback(async () => {
    if (currentPeriod !== 'last-7-days') {
      setTimeSlotData(null);
      return;
    }

    setIsLoadingChart(true);
    try {
      const response = await fetch(`/api/dashboard/time-slots?company=${summary.companyId}`);
      if (response.ok) {
        const result = await response.json();
        setTimeSlotData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch time-slot data:', error);
    } finally {
      setIsLoadingChart(false);
    }
  }, [currentPeriod, summary.companyId]);

  useEffect(() => {
    fetchTimeSlots();
  }, [fetchTimeSlots]);

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

  // Aggregate returns from all channels
  const totalReturns = channels.reduce(
    (acc, ch) => {
      if (ch.returns) {
        acc.current.amount += ch.returns.current.amount;
        acc.current.orderCount += ch.returns.current.orderCount;
        acc.previous.amount += ch.returns.previous.amount;
        acc.previous.orderCount += ch.returns.previous.orderCount;
      }
      return acc;
    },
    {
      current: { amount: 0, orderCount: 0 },
      previous: { amount: 0, orderCount: 0 },
    }
  );
  const hasReturns = totalReturns.current.orderCount > 0 || totalReturns.previous.orderCount > 0;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row justify-end">
        <CompanyLogo companyId={summary.companyId as CompanyId} className="h-5" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time-slot chart for last-7-days period */}
        {currentPeriod === 'last-7-days' && (
          <div className="pb-2 border-b">
            <TimeSlotChart data={timeSlotData} isLoading={isLoadingChart} />
          </div>
        )}

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
          {hasReturns && (
            <MetricRow
              label="Returer"
              current={Math.abs(totalReturns.current.amount)}
              previous={Math.abs(totalReturns.previous.amount)}
              format="currency"
              invertTrend
            />
          )}
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
