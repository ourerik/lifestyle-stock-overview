'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { List, History } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InventoryView } from './inventory-view'
import { InventoryHistoryView } from './inventory-history-view'
import type { InventoryData } from '@/types/inventory'
import type { FifoValuationData } from '@/types/fifo'
import type { CompanyId } from '@/config/companies'

interface InventoryResponse {
  data: InventoryData
  cachedAt: string
  fromCache: boolean
}

interface FifoResponse {
  data: FifoValuationData
  cachedAt: string
  fromCache: boolean
}

type InventoryTab = 'list' | 'history'

interface InventoryPageViewProps {
  companyId: Exclude<CompanyId, 'all'>
}

export function InventoryPageView({ companyId }: InventoryPageViewProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [data, setData] = useState<InventoryData | null>(null)
  const [fifoData, setFifoData] = useState<FifoValuationData | null>(null)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isFifoLoading, setIsFifoLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showZettle = companyId === 'sneaky-steve'

  // Get current tab from URL or default to 'list'
  const currentTab = (searchParams.get('view') as InventoryTab) || 'list'

  const setCurrentTab = useCallback((tab: InventoryTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'list') {
      params.delete('view')
    } else {
      params.set('view', tab)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

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

  const fetchFifoData = useCallback(async () => {
    setIsFifoLoading(true)

    try {
      const params = new URLSearchParams({ company: companyId })
      const response = await fetch(`/api/inventory/valuation?${params}`)

      if (!response.ok) {
        console.error('Failed to fetch FIFO data')
        return
      }

      const result: FifoResponse = await response.json()
      setFifoData(result.data)
    } catch (err) {
      console.error('Error fetching FIFO data:', err)
    } finally {
      setIsFifoLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch FIFO data when switching to history tab
  useEffect(() => {
    if (currentTab === 'history' && !fifoData && !isFifoLoading) {
      fetchFifoData()
    }
  }, [currentTab, fifoData, isFifoLoading, fetchFifoData])

  const handleRefresh = () => {
    fetchData(true)
    if (currentTab === 'history') {
      fetchFifoData()
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as InventoryTab)}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Lagerlista
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Lagerhistorik
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab content */}
      {currentTab === 'list' ? (
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
      ) : (
        <InventoryHistoryView
          fifoData={fifoData}
          isLoading={isFifoLoading}
        />
      )}
    </div>
  )
}
