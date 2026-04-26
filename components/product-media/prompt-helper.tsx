'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Info, Wand2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PromptTemplate {
  title: string
  description: string
  prompt: string
}

interface PromptHelperProps {
  onInsert: (prompt: string) => void
}

const STUDIO_TEMPLATES: PromptTemplate[] = [
  {
    title: 'Byt till vit bakgrund',
    description: 'Packshot mot ren, vit bakgrund med naturlig skugga.',
    prompt:
      'Extract the product from the input image and place it on a plain white opaque background. Preserve product geometry, colors, materials, and label legibility exactly. Add a subtle realistic contact shadow under the product. Studio lighting, sharp focus. Do not change the product in any way.',
  },
  {
    title: 'Byt till färgad/texturerad bakgrund',
    description: 'Byt bakgrund men bevara produkten identisk.',
    prompt:
      'Change only the background of the input image to [DESCRIBE BACKGROUND: e.g. "warm beige gradient", "cracked concrete", "soft pastel pink"]. Keep the product identical — same geometry, colors, materials, lighting on product, framing, and camera angle. Add a subtle realistic contact shadow that matches the new background.',
  },
  {
    title: 'Ny kameravinkel',
    description: 'Rendera samma produkt från en ny vinkel.',
    prompt:
      'Same product shot from a [CHOOSE: 45-degree three-quarter view | top-down packshot | side profile | back view] angle. Studio lighting, seamless white background, preserve product geometry, materials, and colors exactly. Sharp focus on the product.',
  },
  {
    title: 'Närbild på detalj',
    description: 'Makrobild som lyfter fram detaljer.',
    prompt:
      'Macro close-up of [DESCRIBE DETAIL: e.g. "the stitching on the upper", "the sole tread", "the laces and eyelets"]. Shallow depth of field, shot with 100mm macro lens, soft diffused studio lighting. Preserve materials and colors exactly.',
  },
]

const LIFESTYLE_TEMPLATES: PromptTemplate[] = [
  {
    title: 'Person i miljö',
    description: 'Någon som bär produkten i en verklig scen.',
    prompt:
      'A [DESCRIBE PERSON: e.g. "young man in his 20s", "woman walking a dog"] wearing the shoes in [DESCRIBE SETTING: e.g. "a cobblestone street at golden hour", "a sunlit coffee shop", "a misty forest trail"]. Photorealistic, shot like a 35mm film photograph, shallow depth of field, natural color balance, subtle film grain. Preserve the shoes exactly as in the reference image — do not alter colors, materials, laces, or sole.',
  },
  {
    title: 'Närbild i användning',
    description: 'Nära detaljbild på produkten i bruk.',
    prompt:
      'Close-up of hands lacing up the shoes on a [DESCRIBE SURFACE: e.g. "wooden floor", "park bench", "stone doorstep"]. [DESCRIBE LIGHT: e.g. "morning light from a left window", "golden hour from behind"], soft shadows, shallow depth of field. Keep the shoes identical to the reference — same colors, materials, and details.',
  },
  {
    title: 'Stilleben i vardagsmiljö',
    description: 'Produkten ensam i en autentisk miljö.',
    prompt:
      'The shoes placed on [DESCRIBE SURFACE: e.g. "a weathered park bench", "a hotel doorstep next to a newspaper", "a beach towel with sunglasses nearby"]. Natural ambient light, [DESCRIBE MOOD: e.g. "warm evening glow", "cool overcast morning"], photorealistic 35mm film look. Preserve shoe geometry, colors, and materials exactly. No text, no watermarks.',
  },
]

const EDIT_TEMPLATES: PromptTemplate[] = [
  {
    title: 'Byt endast bakgrund',
    description: 'Isolera bakgrundsändring på en tidigare bild.',
    prompt:
      'Change only the background to [DESCRIBE]. Keep everything else the same — product, lighting on product, framing, camera angle, composition.',
  },
  {
    title: 'Byt endast ljus / stämning',
    description: 'Ändra miljöljus utan att röra kompositionen.',
    prompt:
      'Change only the lighting to [DESCRIBE: e.g. "warm golden hour", "cool overcast", "moody blue hour"]. Do not alter the product, framing, camera angle, or background elements. Adjust shadows and highlights naturally to match the new light.',
  },
  {
    title: 'Lägg till ett element',
    description: 'Lägg till något utan att ändra resten.',
    prompt:
      'Add [DESCRIBE ELEMENT: e.g. "a coffee cup next to the shoes", "soft mist in the background"]. Do not change the product, framing, camera angle, lighting on product, or any other existing element.',
  },
  {
    title: 'Generell iterations-guard',
    description: 'Kopiera in i slutet av en egen prompt för att låsa produkten.',
    prompt:
      'Preserve the product geometry, colors, materials, and all visible details exactly as in the reference image. Do not add text, logos, or watermarks. Keep everything else the same unless explicitly changed above.',
  },
]

function TemplateButton({ template, onInsert }: { template: PromptTemplate; onInsert: () => void }) {
  return (
    <button
      type="button"
      onClick={onInsert}
      className="group flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
    >
      <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{template.title}</div>
        <div className="text-xs text-muted-foreground">{template.description}</div>
      </div>
    </button>
  )
}

export function PromptHelper({ onInsert }: PromptHelperProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Promptning-hjälp – mallar &amp; tips
          </span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t p-3">
        <Tabs defaultValue="studio">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="studio">Studio</TabsTrigger>
            <TabsTrigger value="lifestyle">Lifestyle</TabsTrigger>
            <TabsTrigger value="edit">Iterera</TabsTrigger>
          </TabsList>

          <TabsContent value="studio" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              För paket-shots och rena produktbilder. Klicka en mall för att infoga den i prompt-fältet – byt ut <code>[...]</code>-platshållarna.
            </p>
            <div className="space-y-2">
              {STUDIO_TEMPLATES.map((t) => (
                <TemplateButton key={t.title} template={t} onInsert={() => onInsert(t.prompt)} />
              ))}
            </div>
            <TipsBox
              tips={[
                'Nämn alltid kameravinkel och ljuskälla ("diffused studio light from left", "45-degree three-quarter view").',
                'Lås produkten med "Preserve product geometry, colors, materials, and label legibility exactly".',
                'Undvik vaga ord som "vackert" – var konkret ("white seamless background, soft shadow, sharp focus").',
              ]}
            />
          </TabsContent>

          <TabsContent value="lifestyle" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              När produkten ska visas i bruk eller i en verklig miljö. Beskriv personen, platsen och ljuset konkret.
            </p>
            <div className="space-y-2">
              {LIFESTYLE_TEMPLATES.map((t) => (
                <TemplateButton key={t.title} template={t} onInsert={() => onInsert(t.prompt)} />
              ))}
            </div>
            <TipsBox
              tips={[
                'Specificera scen, tid på dygnet och ljus ("golden hour", "overcast morning light").',
                'Fotografiskt språk hjälper realismen: "35mm film", "shallow depth of field", "film grain".',
                'Skriv alltid ut att produkten ska bevaras exakt – annars kan modellen drifta på detaljer som snören, sula, färg.',
                'Om en person är med: "Do not change her/his face, body shape, or identity" håller identiteten stabil.',
              ]}
            />
          </TabsContent>

          <TabsContent value="edit" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              När du itererar på en redan genererad bild – gör en ändring i taget och upprepa bevarande-instruktionerna för att undvika drift.
            </p>
            <div className="space-y-2">
              {EDIT_TEMPLATES.map((t) => (
                <TemplateButton key={t.title} template={t} onInsert={() => onInsert(t.prompt)} />
              ))}
            </div>
            <TipsBox
              tips={[
                '"Change only X" + "Keep everything else the same" är kärnmönstret för iterationer.',
                'Gör EN ändring per generering – kombinera inte bakgrundsbyte, ny ljussättning och ny vinkel i samma prompt.',
                'Upprepa "preserve ..."-listan varje gång – modellen glömmer gamla instruktioner.',
                'Om flera referenser skickas: "Image 1: product photo. Image 2: style reference. Apply Image 2 style to Image 1 product."',
              ]}
            />
          </TabsContent>
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  )
}

function TipsBox({ tips }: { tips: string[] }) {
  return (
    <div className={cn('rounded-lg bg-muted/50 p-3')}>
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Tips</div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
