'use client'

import * as React from 'react'
import { useIsMobile } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'

interface ResponsiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
  desktopClassName?: string
  mobileClassName?: string
}

export function ResponsiveSheet({
  open,
  onOpenChange,
  children,
  className,
  desktopClassName = 'sm:!max-w-5xl',
  mobileClassName = 'max-h-[90vh] rounded-t-xl',
}: ResponsiveSheetProps) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'overflow-y-auto',
          isMobile ? mobileClassName : desktopClassName,
          className
        )}
        showCloseButton={false}
      >
        {/* Drag handle for mobile */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        {children}
      </SheetContent>
    </Sheet>
  )
}

// Re-export for convenience
export { SheetHeader, SheetTitle, SheetDescription, SheetFooter }
