'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CompanyId, COMPANIES, CompanyConfig } from '@/config/companies';

interface CompanyContextValue {
  currentCompany: CompanyId;
  setCompany: (id: CompanyId) => void;
  companyConfig: CompanyConfig;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

interface CompanyProviderProps {
  children: ReactNode;
  defaultCompany?: CompanyId;
}

export function CompanyProvider({ children, defaultCompany = 'all' }: CompanyProviderProps) {
  const [currentCompany, setCurrentCompany] = useState<CompanyId>(defaultCompany);

  const setCompany = useCallback((id: CompanyId) => {
    setCurrentCompany(id);
  }, []);

  const value: CompanyContextValue = {
    currentCompany,
    setCompany,
    companyConfig: COMPANIES[currentCompany],
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
