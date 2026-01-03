'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { CompanyCard } from '@/components/dashboard';
import { PeriodControls } from '@/components/layout/period-controls';
import { usePeriod } from '@/providers/period-provider';
import type { DashboardData, CompanySummary } from '@/types';
import { calculatePercentChange } from '@/lib/utils/currency';
import { CompanyId, COMPANIES } from '@/config/companies';

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const formatter = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });

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

interface DashboardViewProps {
  companyId: CompanyId;
}

export function DashboardView({ companyId }: DashboardViewProps) {
  const { currentPeriod, comparisonType } = usePeriod();
  const companyConfig = COMPANIES[companyId];

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
        company: companyId,
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
  }, [companyId, currentPeriod, comparisonType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const isAllCompanies = companyId === 'all';
  const dateRanges = dashboardData?.dateRanges;
  const totalSales = dashboardData?.totalSales;
  const channels = dashboardData?.channels || [];

  // Build company summaries - either from API (for 'all') or construct from data (for single company)
  const companySummaries: CompanySummary[] = (() => {
    if (isAllCompanies) {
      return dashboardData?.companySummaries || [];
    }

    if (!dashboardData || !totalSales) {
      return [];
    }

    // Calculate B2C average order value (exclude B2B channels)
    const b2cChannels = channels.filter(ch => !ch.channel.includes('b2b'));
    const b2cTotalAmount = b2cChannels.reduce((sum, ch) => sum + ch.sales.current.amount, 0);
    const b2cTotalOrders = b2cChannels.reduce((sum, ch) => sum + ch.sales.current.orderCount, 0);
    const b2cPrevAmount = b2cChannels.reduce((sum, ch) => sum + ch.sales.previous.amount, 0);
    const b2cPrevOrders = b2cChannels.reduce((sum, ch) => sum + ch.sales.previous.orderCount, 0);

    const currentAOV = b2cTotalOrders > 0 ? Math.round(b2cTotalAmount / b2cTotalOrders) : 0;
    const previousAOV = b2cPrevOrders > 0 ? Math.round(b2cPrevAmount / b2cPrevOrders) : 0;

    return [{
      companyId: companyId,
      companyName: companyConfig.name,
      totalSales: totalSales,
      b2cAverageOrderValue: {
        current: { amount: currentAOV, orderCount: b2cTotalOrders, productCount: 0 },
        previous: { amount: previousAOV, orderCount: b2cPrevOrders, productCount: 0 },
        percentChange: calculatePercentChange(currentAOV, previousAOV),
      },
      channels: channels,
    }];
  })();

  return (
    <>
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

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

      <div className={isAllCompanies ? 'grid gap-6 md:grid-cols-2' : ''}>
        {isLoading ? (
          isAllCompanies ? (
            <>
              <CompanyCard summary={{ companyId: '', companyName: '', totalSales: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, b2cAverageOrderValue: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, channels: [] }} loading />
              <CompanyCard summary={{ companyId: '', companyName: '', totalSales: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, b2cAverageOrderValue: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, channels: [] }} loading />
            </>
          ) : (
            <CompanyCard summary={{ companyId: '', companyName: '', totalSales: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, b2cAverageOrderValue: { current: { amount: 0, orderCount: 0, productCount: 0 }, previous: { amount: 0, orderCount: 0, productCount: 0 }, percentChange: 0 }, channels: [] }} loading />
          )
        ) : (
          companySummaries.map((summary) => (
            <CompanyCard
              key={summary.companyId}
              summary={summary}
            />
          ))
        )}
      </div>
    </>
  );
}
