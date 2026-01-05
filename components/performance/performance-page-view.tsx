'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
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

const VALID_PERIODS: PerformancePeriod[] = ['1y', '9m', '6m', '3m', '1m']
const PERIOD_STORAGE_KEY = 'performance-period'
const DEFAULT_PERIOD: PerformancePeriod = '1y'

function isValidPeriod(value: string | null): value is PerformancePeriod {
  return value !== null && VALID_PERIODS.includes(value as PerformancePeriod)
}

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
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [data, setData] = useState<PerformanceData | null>(null)
  const [previousData, setPreviousData] = useState<PerformanceData | null>(null)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize period from URL, localStorage, or default
  const getInitialPeriod = useCallback((): PerformancePeriod => {
    // 1. Check URL first
    const urlPeriod = searchParams.get('period')
    if (isValidPeriod(urlPeriod)) {
      return urlPeriod
    }

    // 2. Check localStorage
    if (typeof window !== 'undefined') {
      const storedPeriod = localStorage.getItem(PERIOD_STORAGE_KEY)
      if (isValidPeriod(storedPeriod)) {
        return storedPeriod
      }
    }

    // 3. Default
    return DEFAULT_PERIOD
  }, [searchParams])

  const [selectedPeriod, setSelectedPeriod] = useState<PerformancePeriod>(getInitialPeriod)
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

  const handlePeriodChange = useCallback((period: PerformancePeriod) => {
    setSelectedPeriod(period)

    // Save to localStorage
    localStorage.setItem(PERIOD_STORAGE_KEY, period)

    // Update URL with period parameter (preserve other params like product)
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', period)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

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
