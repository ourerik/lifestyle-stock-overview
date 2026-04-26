'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Trash2, Upload } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type {
  GlobalReference,
  GlobalReferencesListResponse,
} from '@/types/product-media'

interface GlobalReferencesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: string
  onChanged?: (references: GlobalReference[]) => void
}

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp'

export function GlobalReferencesSheet({
  open,
  onOpenChange,
  company,
  onChanged,
}: GlobalReferencesSheetProps) {
  const [references, setReferences] = useState<GlobalReference[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchReferences = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/product-media/global-references?company=${encodeURIComponent(company)}`,
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `Kunde inte hämta referenser (${res.status})`)
      }
      const json = (await res.json()) as GlobalReferencesListResponse
      setReferences(json.references)
      onChanged?.(json.references)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
    } finally {
      setIsLoading(false)
    }
  }, [company, onChanged])

  useEffect(() => {
    if (open) fetchReferences()
  }, [open, fetchReferences])

  const handleUpload = async (file: File) => {
    setError(null)
    setIsUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (label.trim()) form.append('label', label.trim())

      const res = await fetch(
        `/api/product-media/global-references?company=${encodeURIComponent(company)}`,
        { method: 'POST', body: form },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; details?: string }
        throw new Error(data.error || data.details || `Upload misslyckades (${res.status})`)
      }
      const json = (await res.json()) as { reference: GlobalReference }
      setReferences((prev) => [json.reference, ...prev])
      onChanged?.([json.reference, ...references])
      setLabel('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(
        `/api/product-media/global-references/${encodeURIComponent(id)}?company=${encodeURIComponent(company)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `Kunde inte radera (${res.status})`)
      }
      const json = (await res.json()) as { references: GlobalReference[] }
      setReferences(json.references)
      onChanged?.(json.references)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle>Globala referenser</SheetTitle>
          <SheetDescription>
            Bilder som kan väljas som referenser i alla AI-genereringar för detta bolag.
          </SheetDescription>
        </SheetHeader>

        {/* Upload area */}
        <div className="space-y-3 border-b p-4">
          <div className="space-y-1.5">
            <Label htmlFor="ref-label" className="text-xs">
              Etikett (valfritt)
            </Label>
            <Input
              id="ref-label"
              placeholder="T.ex. 'Studio-bakgrund beige' eller 'Modell i 20-års­åldern'"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isUploading}
            />
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Laddar upp...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Välj fil att ladda upp (PNG, JPG, WebP, max 20 MB)
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Laddar...
            </div>
          ) : references.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Inga globala referenser uppladdade än.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {references.map((ref) => (
                <ReferenceCard
                  key={ref.id}
                  reference={ref}
                  onDelete={() => handleDelete(ref.id)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ReferenceCard({
  reference,
  onDelete,
}: {
  reference: GlobalReference
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card">
      <div className="aspect-square overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={reference.url}
          alt={reference.label}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="space-y-1 p-2">
        <p className="line-clamp-2 text-xs font-medium">{reference.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(reference.createdAt).toLocaleDateString('sv-SE')}
        </p>
      </div>
      <button
        type="button"
        onClick={() => (confirming ? onDelete() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
        className={cn(
          'absolute right-1.5 top-1.5 flex h-7 items-center gap-1 rounded bg-black/70 px-1.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100',
          confirming && 'bg-destructive opacity-100',
        )}
      >
        <Trash2 className="h-3 w-3" />
        {confirming ? 'Bekräfta' : 'Radera'}
      </button>
    </div>
  )
}
