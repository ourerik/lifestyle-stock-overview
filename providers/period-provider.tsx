'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import type { PeriodType, ComparisonType } from '@/types';

const STORAGE_KEY_PERIOD = 'lifestyle-stock-period';
const STORAGE_KEY_COMPARISON = 'lifestyle-stock-comparison';

interface PeriodContextValue {
  currentPeriod: PeriodType;
  comparisonType: ComparisonType;
  setPeriod: (period: PeriodType) => void;
  setComparisonType: (comparison: ComparisonType) => void;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

interface PeriodProviderProps {
  children: ReactNode;
  defaultPeriod?: PeriodType;
  defaultComparison?: ComparisonType;
}

export function PeriodProvider({
  children,
  defaultPeriod = 'today',
  defaultComparison = 'period',
}: PeriodProviderProps) {
  const [currentPeriod, setCurrentPeriod] = useState<PeriodType>(defaultPeriod);
  const [comparisonType, setComparisonTypeState] = useState<ComparisonType>(defaultComparison);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedPeriod = localStorage.getItem(STORAGE_KEY_PERIOD);
    const storedComparison = localStorage.getItem(STORAGE_KEY_COMPARISON);
    if (storedPeriod) setCurrentPeriod(storedPeriod as PeriodType);
    if (storedComparison) setComparisonTypeState(storedComparison as ComparisonType);
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

  const setPeriod = useCallback((period: PeriodType) => {
    setCurrentPeriod(period);
  }, []);

  const setComparisonType = useCallback((comparison: ComparisonType) => {
    setComparisonTypeState(comparison);
  }, []);

  return (
    <PeriodContext.Provider value={{ currentPeriod, comparisonType, setPeriod, setComparisonType }}>
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
