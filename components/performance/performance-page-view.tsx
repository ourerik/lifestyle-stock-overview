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

// Get default date range (last 30 days)
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export function PerformancePageView({ companyId }: PerformancePageViewProps) {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dateRange, setDateRange] = useState(getDefaultDateRange)

  const fetchData = useCallback(async (force = false) => {
    if (force) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const params = new URLSearchParams({
        company: companyId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        ...(force && { force: 'true' }),
      })

      const response = await fetch(`/api/performance?${params}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Kunde inte hämta prestandadata')
      }

      const result: PerformanceResponse = await response.json()
      setData(result.data)
      setCachedAt(new Date(result.cachedAt))
      setFromCache(result.fromCache)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [companyId, dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData(true)
  }

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate })
  }

  return (
    <PerformanceView
      data={data}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      error={error}
      onRefresh={handleRefresh}
      cachedAt={cachedAt}
      fromCache={fromCache}
      dateRange={dateRange}
      onDateRangeChange={handleDateRangeChange}
    />
  )
}
