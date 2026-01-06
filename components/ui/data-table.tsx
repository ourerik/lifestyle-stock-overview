'use client'

import { useState, useMemo, type ReactNode } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Columns } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useColumnVisibility, type ColumnConfig } from '@/hooks/use-column-visibility'
import { formatCurrency } from '@/lib/utils/currency'
import { MobileFullBleed } from '@/components/ui/mobile-full-bleed'

// ============================================================================
// Types
// ============================================================================

export interface Column<T> {
  id: string
  label: string
  accessor: keyof T | ((row: T) => ReactNode)
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string // Tailwind class like "w-24", "min-w-[200px]"
  defaultVisible?: boolean
  format?: 'currency' | 'percent' | 'number' | 'date'
  colorCode?: (value: any, row: T) => 'default' | 'success' | 'warning' | 'danger'
  renderCell?: (value: any, row: T) => ReactNode
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  tableId: string // Used for localStorage column visibility
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  rowKey: keyof T | ((row: T) => string)
  showColumnSelector?: boolean // default true
  hideColumnSelector?: boolean // Hide internal selector (for external placement)
  visibleColumns?: string[] // External control of visible columns
  defaultSortField?: string
  defaultSortOrder?: 'asc' | 'desc'
  // Controlled sorting (for server-side sorting)
  sortBy?: string | null
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
  actions?: (row: T) => ReactNode // For edit/delete buttons
  mobileFullBleed?: boolean // Enable full-bleed horizontal scroll on mobile
}

// ============================================================================
// Color Code Classes
// ============================================================================

const colorCodeClasses = {
  default: '',
  success: 'text-green-600',
  warning: 'text-amber-600',
  danger: 'text-destructive',
} as const

// ============================================================================
// Format Helpers
// ============================================================================

function formatValue(value: any, format?: Column<any>['format']): ReactNode {
  if (value === null || value === undefined) {
    return '-'
  }

  switch (format) {
    case 'currency':
      return formatCurrency(Number(value))
    case 'percent':
      return `${Number(value).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}%`
    case 'number':
      return Number(value).toLocaleString('sv-SE')
    case 'date':
      if (value instanceof Date) {
        return value.toLocaleDateString('sv-SE')
      }
      return new Date(value).toLocaleDateString('sv-SE')
    default:
      return value
  }
}

// ============================================================================
// Column Selector Component
// ============================================================================

interface ColumnSelectorProps {
  columns: ColumnConfig[]
  visibleColumns: string[]
  onToggle: (columnId: string) => void
  onReset: () => void
}

function ColumnSelector({
  columns,
  visibleColumns,
  onToggle,
  onReset,
}: ColumnSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Columns className="h-4 w-4" />
          <span className="hidden sm:inline ml-2">Kolumner</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Visa kolumner</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={visibleColumns.includes(column.id)}
            onCheckedChange={() => onToggle(column.id)}
            onSelect={(e) => e.preventDefault()}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={false}
          onCheckedChange={onReset}
          onSelect={(e) => e.preventDefault()}
        >
          Återställ standard
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ============================================================================
// Sortable Header Component
// ============================================================================

interface SortableHeaderProps {
  columnId: string
  label: string
  sortBy: string | null
  sortOrder: 'asc' | 'desc'
  onSort: (columnId: string) => void
  sortable: boolean
  align?: 'left' | 'right' | 'center'
  width?: string
}

function SortableHeader({
  columnId,
  label,
  sortBy,
  sortOrder,
  onSort,
  sortable,
  align = 'left',
  width,
}: SortableHeaderProps) {
  const isActive = sortBy === columnId
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  const headerContent = sortable ? (
    <button
      onClick={() => onSort(columnId)}
      className={`flex items-center gap-1 hover:text-foreground transition-colors ${
        align === 'right' ? 'ml-auto' : align === 'center' ? 'mx-auto' : ''
      }`}
    >
      {label}
      {isActive ? (
        sortOrder === 'asc' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="h-4 w-4 opacity-50" />
      )}
    </button>
  ) : (
    <span className={align === 'right' ? 'ml-auto block' : align === 'center' ? 'mx-auto block' : ''}>
      {label}
    </span>
  )

  return (
    <TableHead className={`${alignClass} ${width || ''} text-xs md:text-sm`}>
      {headerContent}
    </TableHead>
  )
}

// ============================================================================
// Loading Skeleton Component
// ============================================================================

interface LoadingSkeletonProps {
  columnCount: number
  rowCount?: number
}

function LoadingSkeleton({ columnCount, rowCount = 10 }: LoadingSkeletonProps) {
  return (
    <TableBody>
      {[...Array(rowCount)].map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {[...Array(columnCount)].map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-5 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}

// ============================================================================
// Main DataTable Component
// ============================================================================

export function DataTable<T>({
  data,
  columns,
  tableId,
  loading = false,
  emptyMessage = 'Inga resultat hittades',
  onRowClick,
  rowKey,
  showColumnSelector = true,
  hideColumnSelector = false,
  visibleColumns: externalVisibleColumns,
  defaultSortField,
  defaultSortOrder = 'desc',
  // Controlled sorting props
  sortBy: controlledSortBy,
  sortOrder: controlledSortOrder,
  onSort: controlledOnSort,
  actions,
  mobileFullBleed = false,
}: DataTableProps<T>) {
  // Determine if sorting is controlled externally
  const isControlledSort = controlledOnSort !== undefined

  // Internal sorting state (used when not controlled)
  const [internalSortBy, setInternalSortBy] = useState<string | null>(defaultSortField || null)
  const [internalSortOrder, setInternalSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder)

  // Use controlled or internal sorting state
  const sortBy = isControlledSort ? controlledSortBy ?? null : internalSortBy
  const sortOrder = isControlledSort ? (controlledSortOrder ?? 'desc') : internalSortOrder

  // Convert columns to ColumnConfig for the visibility hook
  const columnConfigs: ColumnConfig[] = useMemo(
    () =>
      columns.map((col) => ({
        id: col.id,
        label: col.label,
        defaultVisible: col.defaultVisible !== false,
      })),
    [columns]
  )

  // Column visibility (use external if provided, otherwise internal hook)
  const internalVisibility = useColumnVisibility(tableId, columnConfigs)
  const visibleColumns = externalVisibleColumns ?? internalVisibility.visibleColumns
  const { toggleColumn, resetToDefaults } = internalVisibility

  // Filter visible columns
  const displayColumns = useMemo(
    () => columns.filter((col) => visibleColumns.includes(col.id)),
    [columns, visibleColumns]
  )

  // Handle sort
  const handleSort = (columnId: string) => {
    if (isControlledSort) {
      // Controlled mode - call the external handler
      controlledOnSort(columnId)
    } else {
      // Internal mode - update local state
      if (sortBy === columnId) {
        setInternalSortOrder(internalSortOrder === 'asc' ? 'desc' : 'asc')
      } else {
        setInternalSortBy(columnId)
        // Default to desc for most fields
        setInternalSortOrder('desc')
      }
    }
  }

  // Get value from accessor
  const getValue = (row: T, accessor: Column<T>['accessor']): any => {
    if (typeof accessor === 'function') {
      return accessor(row)
    }
    return row[accessor]
  }

  // Get row key
  const getRowKey = (row: T): string => {
    if (typeof rowKey === 'function') {
      return rowKey(row)
    }
    return String(row[rowKey])
  }

  // Sorted data
  const sortedData = useMemo(() => {
    // Skip client-side sorting in controlled mode (data is already sorted by server)
    if (isControlledSort) return data

    if (!sortBy) return data

    const sortColumn = columns.find((col) => col.id === sortBy)
    if (!sortColumn) return data

    return [...data].sort((a, b) => {
      let aVal = getValue(a, sortColumn.accessor)
      let bVal = getValue(b, sortColumn.accessor)

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) {
        aVal = sortOrder === 'asc' ? Infinity : -Infinity
      }
      if (bVal === null || bVal === undefined) {
        bVal = sortOrder === 'asc' ? Infinity : -Infinity
      }

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal, 'sv-SE')
          : bVal.localeCompare(aVal, 'sv-SE')
      }

      // Numeric comparison
      const numA = Number(aVal)
      const numB = Number(bVal)
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })
  }, [data, sortBy, sortOrder, columns])

  // Render cell content
  const renderCellContent = (row: T, column: Column<T>): ReactNode => {
    const rawValue = getValue(row, column.accessor)

    // Use custom render if provided
    if (column.renderCell) {
      return column.renderCell(rawValue, row)
    }

    // Format value
    const formattedValue = formatValue(rawValue, column.format)

    // Apply color coding
    if (column.colorCode) {
      const colorType = column.colorCode(rawValue, row)
      const colorClass = colorCodeClasses[colorType]
      return <span className={colorClass}>{formattedValue}</span>
    }

    return formattedValue
  }

  // Calculate total column count (visible columns + actions if present)
  const totalColumnCount = displayColumns.length + (actions ? 1 : 0)

  const tableContent = (
    <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {displayColumns.map((column) => (
                <SortableHeader
                  key={column.id}
                  columnId={column.id}
                  label={column.label}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  sortable={column.sortable !== false}
                  align={column.align}
                  width={column.width}
                />
              ))}
              {actions && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>

          {/* Loading state */}
          {loading && <LoadingSkeleton columnCount={totalColumnCount} />}

          {/* Data rows */}
          {!loading && (
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={totalColumnCount}
                    className="text-center py-12 text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row) => (
                  <TableRow
                    key={getRowKey(row)}
                    className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                    onClick={() => onRowClick?.(row)}
                  >
                    {displayColumns.map((column) => {
                      const alignClass =
                        column.align === 'right'
                          ? 'text-right'
                          : column.align === 'center'
                          ? 'text-center'
                          : 'text-left'

                      return (
                        <TableCell
                          key={column.id}
                          className={`${alignClass} ${column.width || ''} text-xs md:text-sm`}
                        >
                          {renderCellContent(row, column)}
                        </TableCell>
                      )
                    })}
                    {actions && (
                      <TableCell
                        className="w-12"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          )}
        </Table>
    </div>
  )

  return (
    <div className="space-y-2">
      {/* Column selector */}
      {showColumnSelector && !hideColumnSelector && (
        <div className="flex justify-end">
          <ColumnSelector
            columns={columnConfigs}
            visibleColumns={visibleColumns}
            onToggle={toggleColumn}
            onReset={resetToDefaults}
          />
        </div>
      )}

      {/* Table wrapper - with optional mobile full-bleed */}
      {mobileFullBleed ? (
        <MobileFullBleed>{tableContent}</MobileFullBleed>
      ) : (
        tableContent
      )}
    </div>
  )
}

// Export helper types and components for consumers
export type { ColumnConfig }
export { ColumnSelector }
