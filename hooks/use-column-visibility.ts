'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
}

export interface UseColumnVisibilityReturn {
  visibleColumns: string[];
  toggleColumn: (columnId: string) => void;
  isVisible: (columnId: string) => boolean;
  resetToDefaults: () => void;
}

function getStorageKey(tableId: string): string {
  return `table-columns-${tableId}`;
}

function getDefaultVisibleColumns(columns: ColumnConfig[]): string[] {
  return columns.filter((col) => col.defaultVisible).map((col) => col.id);
}

function loadFromStorage(tableId: string): string[] | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(getStorageKey(tableId));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Invalid JSON or other error, return null to use defaults
  }

  return null;
}

function saveToStorage(tableId: string, visibleColumns: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(getStorageKey(tableId), JSON.stringify(visibleColumns));
  } catch {
    // Storage full or other error, silently fail
  }
}

export function useColumnVisibility(
  tableId: string,
  columns: ColumnConfig[]
): UseColumnVisibilityReturn {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    getDefaultVisibleColumns(columns)
  );

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    const stored = loadFromStorage(tableId);
    if (stored !== null) {
      setVisibleColumns(stored);
    }
  }, [tableId]);

  // Save directly when toggling (no useEffect race condition)
  const toggleColumn = useCallback((columnId: string) => {
    setVisibleColumns((prev) => {
      const newValue = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      saveToStorage(tableId, newValue);
      return newValue;
    });
  }, [tableId]);

  const isVisible = useCallback(
    (columnId: string) => {
      return visibleColumns.includes(columnId);
    },
    [visibleColumns]
  );

  const resetToDefaults = useCallback(() => {
    const defaults = getDefaultVisibleColumns(columns);
    setVisibleColumns(defaults);
    saveToStorage(tableId, defaults);
  }, [columns, tableId]);

  return {
    visibleColumns,
    toggleColumn,
    isVisible,
    resetToDefaults,
  };
}
