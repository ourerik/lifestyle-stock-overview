'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AdCostsForm } from './ad-costs-form'
import { AdCostsList } from './ad-costs-list'
import type { CompanyId } from '@/config/companies'
import type { AdCostDocument, AdCostsResponse } from '@/types/ad-costs'

interface AdCostsPageViewProps {
  companyId: Exclude<CompanyId, 'all'>
}

export function AdCostsPageView({ companyId }: AdCostsPageViewProps) {
  const [costs, setCosts] = useState<AdCostDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingCost, setEditingCost] = useState<AdCostDocument | null>(null)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)

  const fetchCosts = useCallback(async (force = false) => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({ company: companyId })
      if (force) params.set('force', 'true')

      const response = await fetch(`/api/ad-costs?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch ad costs')
      }

      const data: AdCostsResponse = await response.json()
      setCosts(data.costs)
      setCachedAt(new Date(data.cachedAt))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchCosts()
  }, [fetchCosts])

  const handleSave = async (data: { year: number; month: number; metaCost: number; googleCost: number }) => {
    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/ad-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: companyId, ...data }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save')
      }

      // Refresh the list
      await fetchCosts(true)
      setEditingCost(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (cost: AdCostDocument) => {
    if (!confirm(`Vill du ta bort annonskostnaden för ${cost.year}-${String(cost.month).padStart(2, '0')}?`)) {
      return
    }

    try {
      setIsDeleting(cost.id)
      setError(null)

      const params = new URLSearchParams({
        company: companyId,
        year: cost.year.toString(),
        month: cost.month.toString(),
      })

      const response = await fetch(`/api/ad-costs?${params}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      // Refresh the list
      await fetchCosts(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ta bort')
    } finally {
      setIsDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Annonskostnader</h2>
          <p className="text-sm text-muted-foreground">
            Lägg till månatliga annonskostnader för Meta och Google för att beräkna TB med annonser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cachedAt && (
            <span className="text-sm text-muted-foreground">
              Uppdaterad {cachedAt.toLocaleTimeString('sv-SE')}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCosts(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <AdCostsForm
        existingCost={editingCost}
        onSave={handleSave}
        onCancel={editingCost ? () => setEditingCost(null) : undefined}
        isSaving={isSaving}
      />

      {/* List */}
      <div>
        <h3 className="text-sm font-medium mb-3">Registrerade kostnader</h3>
        <AdCostsList
          costs={costs}
          isLoading={isLoading}
          onEdit={setEditingCost}
          onDelete={handleDelete}
          isDeleting={isDeleting}
        />
      </div>

      {/* Info */}
      <Alert>
        <AlertDescription>
          <strong>OBS:</strong> Om ingen annonskostnad finns för en period används standardvärdet 100 SEK per order vid beräkning av TB med annonser.
        </AlertDescription>
      </Alert>
    </div>
  )
}
