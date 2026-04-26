'use client'

import { useState, useRef } from 'react'
import { Loader2, Sparkles, AlertCircle, Check, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PromptHelper } from './prompt-helper'
import type {
  GeneratedImage,
  ImageQuality,
  ImageSize,
} from '@/types/product-media'

export type ReferenceKind = 'original' | 'generated' | 'global'

export interface AvailableReference {
  url: string
  label: string
  kind: ReferenceKind
}

interface GenerateImageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articleNo: string
  company: string
  availableReferences: AvailableReference[]
  onGenerated: (image: GeneratedImage) => void
}

const GROUP_LABELS: Record<ReferenceKind, string> = {
  original: 'Originalbilder',
  generated: 'Tidigare genererade',
  global: 'Globala referenser',
}

const GROUP_ORDER: ReferenceKind[] = ['original', 'generated', 'global']

const SIZE_OPTIONS: Array<{ value: ImageSize; label: string }> = [
  { value: '1024x1024', label: 'Kvadrat 1024×1024' },
  { value: '1024x1536', label: 'Stående 1024×1536' },
  { value: '1536x1024', label: 'Liggande 1536×1024' },
  { value: '2000x1000', label: 'Panorama 2000×1000' },
  { value: '1000x2000', label: 'Panorama stående 1000×2000' },
]

const QUALITY_OPTIONS: Array<{ value: ImageQuality; label: string; hint: string }> = [
  { value: 'low', label: 'Låg', hint: '~$0.01 – snabb iteration' },
  { value: 'medium', label: 'Medium', hint: '~$0.04 – default' },
  { value: 'high', label: 'Hög', hint: '~$0.21 – prod-kvalitet' },
]

interface StreamState {
  isGenerating: boolean
  partials: string[]           // data URLs of partial frames, in order
  latestIndex: number | null
  completed: boolean           // model said "complete", waiting for done/save
}

const initialStream: StreamState = {
  isGenerating: false,
  partials: [],
  latestIndex: null,
  completed: false,
}

export function GenerateImageModal({
  open,
  onOpenChange,
  articleNo,
  company,
  availableReferences,
  onGenerated,
}: GenerateImageModalProps) {
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set())
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<ImageSize>('1024x1024')
  const [quality, setQuality] = useState<ImageQuality>('medium')
  const [stream, setStream] = useState<StreamState>(initialStream)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const toggleRef = (url: string) => {
    setSelectedRefs((prev) => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        if (next.size >= 16) {
          setError('Max 16 referensbilder kan skickas till modellen')
          return prev
        }
        next.add(url)
      }
      return next
    })
  }

  const handleInsertPrompt = (text: string) => {
    setPrompt((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
  }

  const resetAndClose = () => {
    setStream(initialStream)
    setPrompt('')
    setSelectedRefs(new Set())
    setError(null)
    onOpenChange(false)
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStream(initialStream)
  }

  const handleGenerate = async () => {
    setError(null)
    if (!prompt.trim()) {
      setError('Skriv en prompt först')
      return
    }

    setStream({ ...initialStream, isGenerating: true })
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(
        `/api/product-media/${encodeURIComponent(articleNo)}/generate?company=${encodeURIComponent(company)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            referenceImageUrls: Array.from(selectedRefs),
            size,
            quality,
          }),
          signal: controller.signal,
        },
      )
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; details?: string }
        throw new Error(data.error || data.details || `Generering misslyckades (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let event: Record<string, unknown>
          try {
            event = JSON.parse(trimmed) as Record<string, unknown>
          } catch {
            continue
          }

          const type = event.type

          if (type === 'partial' && typeof event.b64 === 'string') {
            const dataUrl = `data:image/png;base64,${event.b64}`
            const index =
              typeof event.index === 'number' ? event.index : 0
            setStream((prev) => ({
              ...prev,
              partials: [...prev.partials, dataUrl],
              latestIndex: index,
            }))
          } else if (type === 'complete') {
            setStream((prev) => ({ ...prev, completed: true }))
          } else if (type === 'done' && event.image) {
            onGenerated(event.image as GeneratedImage)
            resetAndClose()
            return
          } else if (type === 'error') {
            throw new Error((event.message as string) || 'Okänt fel')
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Okänt fel')
      setStream(initialStream)
    } finally {
      abortRef.current = null
    }
  }

  const isGenerating = stream.isGenerating
  const latestPartial = stream.partials[stream.partials.length - 1]

  const handleOpenChange = (next: boolean) => {
    if (!next && isGenerating) {
      handleCancel()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isGenerating ? 'Genererar bild...' : 'Generera ny bild'}
          </DialogTitle>
          <DialogDescription>
            {isGenerating
              ? 'Partial-frames visas löpande. Slutbilden sparas när den är klar.'
              : 'Välj en eller flera referensbilder, skriv en prompt och välj inställningar.'}
          </DialogDescription>
        </DialogHeader>

        {isGenerating ? (
          <GeneratingView
            promptPreview={prompt}
            latestPartial={latestPartial}
            partialCount={stream.partials.length}
            completed={stream.completed}
            onCancel={handleCancel}
          />
        ) : (
          <div className="space-y-5">
            {/* Reference picker (grouped by kind) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Referensbilder{' '}
                  <span className="text-muted-foreground">({selectedRefs.size} valda)</span>
                </label>
                {selectedRefs.size > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRefs(new Set())}
                  >
                    Rensa val
                  </Button>
                )}
              </div>
              {availableReferences.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga bilder tillgängliga</p>
              ) : (
                <div className="space-y-3">
                  {GROUP_ORDER.map((kind) => {
                    const items = availableReferences.filter((r) => r.kind === kind)
                    if (items.length === 0) return null
                    return (
                      <div key={kind} className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {GROUP_LABELS[kind]} ({items.length})
                        </div>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                          {items.map((ref) => {
                            const selected = selectedRefs.has(ref.url)
                            return (
                              <button
                                key={ref.url}
                                type="button"
                                onClick={() => toggleRef(ref.url)}
                                className={cn(
                                  'group relative aspect-square overflow-hidden rounded-lg border-2 bg-muted transition-all',
                                  selected
                                    ? 'border-primary ring-2 ring-primary/30'
                                    : 'border-transparent hover:border-muted-foreground/30',
                                )}
                                title={ref.label}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={ref.url}
                                  alt={ref.label}
                                  className="h-full w-full object-cover"
                                />
                                {selected && (
                                  <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                    <Check className="h-3 w-3" />
                                  </div>
                                )}
                                {ref.kind === 'generated' && (
                                  <div className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
                                    AI
                                  </div>
                                )}
                                {ref.kind === 'global' && (
                                  <div className="absolute left-1 top-1 rounded bg-primary/80 px-1 py-0.5 text-[9px] font-medium text-primary-foreground">
                                    GLOBAL
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Prompt helper */}
            <PromptHelper onInsert={handleInsertPrompt} />

            {/* Prompt textarea */}
            <div className="space-y-2">
              <label htmlFor="prompt" className="text-sm font-medium">
                Prompt
              </label>
              <Textarea
                id="prompt"
                placeholder="Beskriv den bild du vill generera..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>

            {/* Settings */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Storlek</label>
                <Select value={size} onValueChange={(v) => setSize(v as ImageSize)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Kvalitet</label>
                <Select value={quality} onValueChange={(v) => setQuality(v as ImageQuality)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {isGenerating ? (
            <Button type="button" variant="outline" onClick={handleCancel}>
              <X className="mr-2 h-4 w-4" />
              Avbryt
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Stäng
              </Button>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!prompt.trim()}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generera
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GeneratingView({
  promptPreview,
  latestPartial,
  partialCount,
  completed,
  onCancel,
}: {
  promptPreview: string
  latestPartial: string | undefined
  partialCount: number
  completed: boolean
  onCancel: () => void
}) {
  const status = completed
    ? 'Slutbild klar, sparar...'
    : partialCount === 0
      ? 'Väntar på första preview...'
      : `Preview ${partialCount} mottagen – förbättrar...`

  // avoid unused warning, we keep the hook for symmetry
  void onCancel

  return (
    <div className="space-y-4">
      <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
        {latestPartial ? (
          <img
            src={latestPartial}
            alt="Preview"
            className={cn(
              'h-full w-full object-contain transition-opacity duration-300',
              completed ? 'opacity-100' : 'opacity-90',
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        {completed ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        <span className="text-muted-foreground">{status}</span>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Prompt
        </div>
        <p className="line-clamp-3 whitespace-pre-wrap font-mono text-xs text-foreground">
          {promptPreview}
        </p>
      </div>
    </div>
  )
}
