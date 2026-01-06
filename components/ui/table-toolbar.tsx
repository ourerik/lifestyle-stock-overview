'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ColumnSelector } from '@/components/ui/data-table'
import type { ColumnConfig } from '@/hooks/use-column-visibility'

interface TableToolbarProps {
  // Search
  searchQuery: string
  onSearchChange: (query: string) => void
  searchPlaceholder?: string

  // Column selector
  columnConfigs: ColumnConfig[]
  visibleColumns: string[]
  onToggleColumn: (columnId: string) => void
  onResetColumns: () => void

  // Optional filters (rendered between search and column selector)
  filters?: ReactNode
}

export function TableToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Sök...',
  columnConfigs,
  visibleColumns,
  onToggleColumn,
  onResetColumns,
  filters,
}: TableToolbarProps) {
  const [searchExpanded, setSearchExpanded] = useState(false)
  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  // Focus the appropriate search input when expanded
  useEffect(() => {
    if (searchExpanded) {
      // Try desktop first, then mobile
      if (desktopInputRef.current && window.innerWidth >= 640) {
        desktopInputRef.current.focus()
      } else if (mobileInputRef.current) {
        mobileInputRef.current.focus()
      }
    }
  }, [searchExpanded])

  return (
    <div className="space-y-2 mb-3">
      {/* Main toolbar row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Search + filters as button group */}
        <div className="flex items-center">
          {/* Desktop: show search input inline when expanded */}
          {searchExpanded && (
            <div className="relative mr-2 hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={desktopInputRef}
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onBlur={() => {
                  if (!searchQuery) setSearchExpanded(false)
                }}
                className="pl-10 w-48 h-8 transition-all"
              />
            </div>
          )}

          {/* Button group: search button (when collapsed or on mobile) + filters */}
          <div className="inline-flex items-center rounded-md border border-input [&>*]:border-0 [&>*]:rounded-none [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-input">
            {/* Search button - always visible on mobile, hidden on desktop when expanded */}
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 ${searchExpanded ? 'sm:hidden' : ''}`}
              onClick={() => setSearchExpanded(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
            {filters}
          </div>
        </div>

        {/* Right: Column selector */}
        <ColumnSelector
          columns={columnConfigs}
          visibleColumns={visibleColumns}
          onToggle={onToggleColumn}
          onReset={onResetColumns}
        />
      </div>

      {/* Mobile: search input below toolbar when expanded */}
      {searchExpanded && (
        <div className="relative sm:hidden">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={mobileInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={() => {
              if (!searchQuery) setSearchExpanded(false)
            }}
            className="pl-10 h-8"
          />
        </div>
      )}
    </div>
  )
}
