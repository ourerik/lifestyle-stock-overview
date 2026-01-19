'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import type { PeriodType, ComparisonType, CustomDateRange } from '@/types';

const STORAGE_KEY_PERIOD = 'lifestyle-stock-period';
const STORAGE_KEY_COMPARISON = 'lifestyle-stock-comparison';
const STORAGE_KEY_CUSTOM_RANGE = 'lifestyle-stock-custom-range';

interface PeriodContextValue {
  currentPeriod: PeriodType;
  comparisonType: ComparisonType;
  customDateRange: CustomDateRange | null;
  setPeriod: (period: PeriodType) => void;
  setComparisonType: (comparison: ComparisonType) => void;
  setCustomDateRange: (range: CustomDateRange | null) => void;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

interface PeriodProviderProps {
  children: ReactNode;
  defaultPeriod?: PeriodType;
  defaultComparison?: ComparisonType;
}

export function PeriodProvider({
  children,
  defaultPeriod = 'last-7-days',
  defaultComparison = 'period',
}: PeriodProviderProps) {
  const [currentPeriod, setCurrentPeriod] = useState<PeriodType>(defaultPeriod);
  const [comparisonType, setComparisonTypeState] = useState<ComparisonType>(defaultComparison);
  const [customDateRange, setCustomDateRangeState] = useState<CustomDateRange | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedPeriod = localStorage.getItem(STORAGE_KEY_PERIOD);
    const storedComparison = localStorage.getItem(STORAGE_KEY_COMPARISON);
    const storedCustomRange = localStorage.getItem(STORAGE_KEY_CUSTOM_RANGE);

    if (storedPeriod) setCurrentPeriod(storedPeriod as PeriodType);
    if (storedComparison) setComparisonTypeState(storedComparison as ComparisonType);
    if (storedCustomRange) {
      try {
        setCustomDateRangeState(JSON.parse(storedCustomRange));
      } catch {
        // Ignore invalid stored data
      }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEY_PERIOD, currentPeriod);
  }, [currentPeriod, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEY_COMPARISON, comparisonType);
  }, [comparisonType, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (customDateRange) {
      localStorage.setItem(STORAGE_KEY_CUSTOM_RANGE, JSON.stringify(customDateRange));
    } else {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_RANGE);
    }
  }, [customDateRange, isHydrated]);

  const setPeriod = useCallback((period: PeriodType) => {
    setCurrentPeriod(period);
    // Clear custom date range when switching to non-custom period
    if (period !== 'custom') {
      setCustomDateRangeState(null);
    }
  }, []);

  const setComparisonType = useCallback((comparison: ComparisonType) => {
    setComparisonTypeState(comparison);
  }, []);

  const setCustomDateRange = useCallback((range: CustomDateRange | null) => {
    setCustomDateRangeState(range);
    if (range) {
      setCurrentPeriod('custom');
    }
  }, []);

  return (
    <PeriodContext.Provider value={{
      currentPeriod,
      comparisonType,
      customDateRange,
      setPeriod,
      setComparisonType,
      setCustomDateRange,
    }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  const context = useContext(PeriodContext);
  if (!context) {
    throw new Error('usePeriod must be used within a PeriodProvider');
  }
  return context;
}
