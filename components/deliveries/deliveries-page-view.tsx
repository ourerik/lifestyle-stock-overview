'use client'

import { useEffect, useState, useCallback } from 'react'
import { DeliveriesView } from './deliveries-view'
import type { DeliveriesResponse, DeliverySortField } from '@/types/delivery'
import type { CompanyId } from '@/config/companies'

interface DeliveriesPageViewProps {
  companyId: Exclude<CompanyId, 'all'>
}

export function DeliveriesPageView({ companyId }: DeliveriesPageViewProps) {
  const [data, setData] = useState<DeliveriesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination and sorting state
  const [page, setPage] = useState(0)
  const [pageSize] = useState(50)
  const [sortBy, setSortBy] = useState<DeliverySortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        company: companyId,
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
      })

      const response = await fetch(`/api/deliveries?${params}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Kunde inte hämta leveranser')
      }

      const result: DeliveriesResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }, [companyId, page, pageSize, sortBy, sortOrder])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSort = (field: DeliverySortField) => {
    if (field === sortBy) {
      // Toggle order if same field
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      // New field, default to desc
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(0) // Reset to first page when sorting
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  return (
    <DeliveriesView
      data={data}
      isLoading={isLoading}
      error={error}
      page={page}
      pageSize={pageSize}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={handleSort}
      onPageChange={handlePageChange}
    />
  )
}
