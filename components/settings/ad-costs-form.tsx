'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdCostDocument } from '@/types/ad-costs'

interface AdCostsFormProps {
  existingCost?: AdCostDocument | null
  onSave: (data: { year: number; month: number; metaCost: number; googleCost: number }) => Promise<void>
  onCancel?: () => void
  isSaving?: boolean
}

const MONTHS = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Mars' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Maj' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Augusti' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

export function AdCostsForm({
  existingCost,
  onSave,
  onCancel,
  isSaving,
}: AdCostsFormProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [year, setYear] = useState(existingCost?.year || currentYear)
  const [month, setMonth] = useState(existingCost?.month || currentMonth)
  const [metaCost, setMetaCost] = useState(existingCost?.metaCost?.toString() || '')
  const [googleCost, setGoogleCost] = useState(existingCost?.googleCost?.toString() || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await onSave({
      year,
      month,
      metaCost: parseFloat(metaCost) || 0,
      googleCost: parseFloat(googleCost) || 0,
    })

    // Reset form if not editing
    if (!existingCost) {
      setMetaCost('')
      setGoogleCost('')
    }
  }

  const totalCost = (parseFloat(metaCost) || 0) + (parseFloat(googleCost) || 0)

  // Generate year options (current year and 2 years back)
  const years = [currentYear, currentYear - 1, currentYear - 2]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{existingCost ? 'Redigera annonskostnad' : 'Lägg till annonskostnad'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="year">År</Label>
              <Select
                value={year.toString()}
                onValueChange={(v) => setYear(parseInt(v))}
                disabled={!!existingCost}
              >
                <SelectTrigger id="year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">Månad</Label>
              <Select
                value={month.toString()}
                onValueChange={(v) => setMonth(parseInt(v))}
                disabled={!!existingCost}
              >
                <SelectTrigger id="month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="metaCost">Meta-kostnad (SEK)</Label>
              <Input
                id="metaCost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={metaCost}
                onChange={(e) => setMetaCost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="googleCost">Google-kostnad (SEK)</Label>
              <Input
                id="googleCost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={googleCost}
                onChange={(e) => setGoogleCost(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              Total: <span className="font-medium text-foreground">{totalCost.toLocaleString('sv-SE')} SEK</span>
            </div>
            <div className="flex gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Avbryt
                </Button>
              )}
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Sparar...' : existingCost ? 'Uppdatera' : 'Spara'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
