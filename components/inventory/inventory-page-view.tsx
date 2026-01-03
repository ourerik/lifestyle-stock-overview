'use client'

import { useEffect, useState, useCallback } from 'react'
import { InventoryView } from './inventory-view'
import type { InventoryData } from '@/types/inventory'
import type { CompanyId } from '@/config/companies'

interface InventoryResponse {
  data: InventoryData
  cachedAt: string
  fromCache: boolean
}

interface InventoryPageViewProps {
  companyId: Exclude<CompanyId, 'all'>
}

export function InventoryPageView({ companyId }: InventoryPageViewProps) {
  const [data, setData] = useState<InventoryData | null>(null)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showZettle = companyId === 'sneaky-steve'

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
        ...(force && { force: 'true' }),
      })

      const response = await fetch(`/api/inventory?${params}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Kunde inte hämta lagerdata')
      }

      const result: InventoryResponse = await response.json()
      setData(result.data)
      setCachedAt(new Date(result.cachedAt))
      setFromCache(result.fromCache)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData(true)
  }

  return (
    <InventoryView
      data={data}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      error={error}
      onRefresh={handleRefresh}
      showZettle={showZettle}
      cachedAt={cachedAt}
      fromCache={fromCache}
      companyId={companyId}
    />
  )
}
