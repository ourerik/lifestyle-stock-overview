'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { Alert } from '@/components/ui/alert';
import { SalesCard, ChannelBreakdown, CompanyCard } from '@/components/dashboard';
import { PeriodControls } from '@/components/layout/period-controls';
import { useCompany } from '@/providers/company-provider';
import { usePeriod } from '@/providers/period-provider';
import type { DashboardData } from '@/types';
import { calculatePercentChange } from '@/lib/utils/currency';

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const formatter = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });

  // If same day, show just one date
  if (start.slice(0, 10) === end.slice(0, 10)) {
    return formatter.format(startDate);
  }

  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

interface DashboardResponse {
  data: DashboardData;
  cachedAt: string;
  fromCache: boolean;
}

export default function DashboardPage() {
  const { currentCompany, companyConfig } = useCompany();
  const { currentPeriod, comparisonType } = usePeriod();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    if (force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        company: currentCompany,
        period: currentPeriod,
        comparison: comparisonType,
        ...(force && { force: 'true' }),
      });

      const response = await fetch(`/api/dashboard?${params}`);

      if (!response.ok) {
        throw new Error('Kunde inte hämta data');
      }

      const result: DashboardResponse = await response.json();
      setDashboardData(result.data);
      setLastUpdated(new Date(result.cachedAt));
      setFromCache(result.fromCache);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentCompany, currentPeriod, comparisonType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  // Check if viewing all companies
  const isAllCompanies = currentCompany === 'all';
  const companySummaries = dashboardData?.companySummaries || [];
  const dateRanges = dashboardData?.dateRanges;

  // Build comparison label from date ranges
  const comparisonLabel = dateRanges ? `vs ${dateRanges.previous.label.toLowerCase()}` : 'vs föregående';

  // Calculate derived values
  const totalSales = dashboardData?.totalSales;
  const channels = dashboardData?.channels || [];

  // Calculate total returns from channels
  const totalReturns = channels.reduce((sum, ch) => {
    return sum + (ch.returns?.current.amount || 0);
  }, 0);
  const previousTotalReturns = channels.reduce((sum, ch) => {
    return sum + (ch.returns?.previous.amount || 0);
  }, 0);

  // Calculate AOV (Average Order Value)
  const currentAOV = totalSales && totalSales.current.orderCount > 0
    ? Math.round(totalSales.current.amount / totalSales.current.orderCount)
    : 0;
  const previousAOV = totalSales && totalSales.previous.orderCount > 0
    ? Math.round(totalSales.previous.amount / totalSales.previous.orderCount)
    : 0;

  // Calculate net result (sales - returns)
  const currentNet = (totalSales?.current.amount || 0) + totalReturns; // returns are negative
  const previousNet = (totalSales?.previous.amount || 0) + previousTotalReturns;

  return (
    <SidebarInset>
      <Header title={`Dashboard - ${companyConfig.name}`} />
      <main className="flex-1 p-6">
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Period controls and date info */}
        <Alert variant="info" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {dateRanges ? (
                <>
                  <span>
                    <span className="font-medium">{dateRanges.current.label}:</span>{' '}
                    {formatDateRange(dateRanges.current.start, dateRanges.current.end)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{dateRanges.previous.label}:</span>{' '}
                    {formatDateRange(dateRanges.previous.start, dateRanges.previous.end)}
                  </span>
                  </>
              ) : (
                <span className="text-muted-foreground">Laddar...</span>
              )}
            </div>
            <PeriodControls
              lastUpdated={lastUpdated}
              fromCache={fromCache}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          </div>
        </Alert>

        {/* Company cards for "all" view, or summary cards for single company */}
        {isAllCompanies ? (
          <div className="grid gap-6 md:grid-cols-2">
            {isLoading ? (
              <>
                <CompanyCard summary={{ companyId: '', companyName: '', totalSales: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, b2cAverageOrderValue: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, channels: [] }} loading />
                <CompanyCard summary={{ companyId: '', companyName: '', totalSales: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, b2cAverageOrderValue: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, channels: [] }} loading />
              </>
            ) : (
              companySummaries.map((summary) => (
                <CompanyCard
                  key={summary.companyId}
                  summary={summary}
                />
              ))
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <SalesCard
              title="Total försäljning"
              data={totalSales || {
                current: { amount: 0, orderCount: 0, productCount: 0 },
                previous: { amount: 0, orderCount: 0, productCount: 0 },
                percentChange: 0,
              }}
              comparisonLabel={comparisonLabel}
              loading={isLoading}
            />
            <SalesCard
              title="Ordrar"
              data={{
                current: { amount: totalSales?.current.orderCount || 0, orderCount: totalSales?.current.orderCount || 0, productCount: 0 },
                previous: { amount: totalSales?.previous.orderCount || 0, orderCount: totalSales?.previous.orderCount || 0, productCount: 0 },
                percentChange: calculatePercentChange(
                  totalSales?.current.orderCount || 0,
                  totalSales?.previous.orderCount || 0
                ),
              }}
              comparisonLabel={comparisonLabel}
              loading={isLoading}
            />
            <SalesCard
              title="Snittordervärde"
              data={{
                current: { amount: currentAOV, orderCount: 0, productCount: 0 },
                previous: { amount: previousAOV, orderCount: 0, productCount: 0 },
                percentChange: calculatePercentChange(currentAOV, previousAOV),
              }}
              comparisonLabel={comparisonLabel}
              loading={isLoading}
            />
            <SalesCard
              title="Nettoresultat"
              data={{
                current: { amount: currentNet, orderCount: 0, productCount: 0 },
                previous: { amount: previousNet, orderCount: 0, productCount: 0 },
                percentChange: calculatePercentChange(currentNet, previousNet),
              }}
              comparisonLabel={comparisonLabel}
              loading={isLoading}
            />
          </div>
        )}

        {/* Channel breakdown - only for single company view */}
        {!isAllCompanies && (
          <div className="mt-6">
            <ChannelBreakdown channels={channels} loading={isLoading} />
          </div>
        )}
      </main>
    </SidebarInset>
  );
}
