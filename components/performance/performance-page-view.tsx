'use client'

import { useEffect, useState, useCallback } from 'react'
import { PerformanceView } from './performance-view'
import type { PerformanceData } from '@/types/performance'
import type { CompanyId } from '@/config/companies'

interface PerformanceResponse {
  data: PerformanceData
  cachedAt: string
  fromCache: boolean
}

interface PerformancePageViewProps {
  companyId: Exclude<CompanyId, 'all'>
}

export type PerformancePeriod = '1y' | '9m' | '6m' | '3m' | '1m'

// Returns need time to come in, so we always offset by 14 days
const RETURN_DELAY_DAYS = 14

// Calculate date range based on selected period, with 14-day offset
// yearOffset = 0 for current year, 1 for same period last year
function getDateRangeForPeriod(period: PerformancePeriod, yearOffset = 0): { startDate: string; endDate: string } {
  const end = new Date()
  end.setDate(end.getDate() - RETURN_DELAY_DAYS) // Always offset end date by 14 days

  const start = new Date(end)

  // First set the period length
  switch (period) {
    case '1y':
      start.setFullYear(start.getFullYear() - 1)
      break
    case '9m':
      start.setMonth(start.getMonth() - 9)
      break
    case '6m':
      start.setMonth(start.getMonth() - 6)
      break
    case '3m':
      start.setMonth(start.getMonth() - 3)
      break
    case '1m':
      start.setMonth(start.getMonth() - 1)
      break
  }

  // Then apply year offset (for comparing to same period last year)
  if (yearOffset > 0) {
    start.setFullYear(start.getFullYear() - yearOffset)
    end.setFullYear(end.getFullYear() - yearOffset)
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export function PerformancePageView({ companyId }: PerformancePageViewProps) {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [previousData, setPreviousData] = useState<PerformanceData | null>(null)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedPeriod, setSelectedPeriod] = useState<PerformancePeriod>('1y')
  const dateRange = getDateRangeForPeriod(selectedPeriod)
  const previousDateRange = getDateRangeForPeriod(selectedPeriod, 1)

  const fetchData = useCallback(async (force = false) => {
    if (force) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      // Fetch current and previous period in parallel
      const currentParams = new URLSearchParams({
        company: companyId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        ...(force && { force: 'true' }),
      })

      const previousParams = new URLSearchParams({
        company: companyId,
        startDate: previousDateRange.startDate,
        endDate: previousDateRange.endDate,
        ...(force && { force: 'true' }),
      })

      const [currentResponse, previousResponse] = await Promise.all([
        fetch(`/api/performance?${currentParams}`),
        fetch(`/api/performance?${previousParams}`),
      ])

      if (!currentResponse.ok) {
        const errorData = await currentResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Kunde inte hämta prestandadata')
      }

      const currentResult: PerformanceResponse = await currentResponse.json()
      setData(currentResult.data)
      setCachedAt(new Date(currentResult.cachedAt))
      setFromCache(currentResult.fromCache)

      // Previous period data (don't fail if this fails)
      if (previousResponse.ok) {
        const previousResult: PerformanceResponse = await previousResponse.json()
        setPreviousData(previousResult.data)
      } else {
        setPreviousData(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [companyId, selectedPeriod])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData(true)
  }

  const handlePeriodChange = (period: PerformancePeriod) => {
    setSelectedPeriod(period)
  }

  return (
    <PerformanceView
      data={data}
      previousData={previousData}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      error={error}
      onRefresh={handleRefresh}
      cachedAt={cachedAt}
      fromCache={fromCache}
      dateRange={dateRange}
      selectedPeriod={selectedPeriod}
      onPeriodChange={handlePeriodChange}
      companyId={companyId}
    />
  )
}
