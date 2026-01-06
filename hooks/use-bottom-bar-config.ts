'use client';

import { useState, useEffect, useCallback } from 'react';

export interface BottomBarSlot {
  id: string;
  icon: string;
  label: string;
  href: string;
}

export interface AvailablePage {
  id: string;
  icon: string;
  label: string;
  href: string;
  requiresCompany: boolean;
}

const STORAGE_KEY = 'mobile-bottom-bar-slots';

const DEFAULT_SLOTS: BottomBarSlot[] = [
  { id: 'dashboard', icon: 'LayoutDashboard', label: 'Dashboard', href: '/{company}' },
  { id: 'inventory', icon: 'Package', label: 'Lager', href: '/{company}/inventory' },
  { id: 'performance', icon: 'BarChart3', label: 'Prestation', href: '/{company}/performance' },
];

const AVAILABLE_PAGES: AvailablePage[] = [
  { id: 'overview', icon: 'Home', label: 'Översikt', href: '/', requiresCompany: false },
  { id: 'dashboard', icon: 'LayoutDashboard', label: 'Dashboard', href: '/{company}', requiresCompany: true },
  { id: 'inventory', icon: 'Package', label: 'Lager', href: '/{company}/inventory', requiresCompany: true },
  { id: 'deliveries', icon: 'Truck', label: 'Inleveranser', href: '/{company}/deliveries', requiresCompany: true },
  { id: 'performance', icon: 'BarChart3', label: 'Prestation', href: '/{company}/performance', requiresCompany: true },
  { id: 'settings', icon: 'Settings', label: 'Inställningar', href: '/{company}/settings/ad-costs', requiresCompany: true },
];

export function useBottomBarConfig(): {
  slots: BottomBarSlot[];
  setSlot: (index: number, slot: BottomBarSlot) => void;
  availablePages: AvailablePage[];
  resetToDefaults: () => void;
} {
  const [slots, setSlots] = useState<BottomBarSlot[]>(DEFAULT_SLOTS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as BottomBarSlot[];
        if (Array.isArray(parsed) && parsed.length === 3) {
          setSlots(parsed);
        }
      }
    } catch {
      // Invalid JSON or localStorage unavailable, use defaults
    }
  }, []);

  const setSlot = useCallback((index: number, slot: BottomBarSlot) => {
    if (index < 0 || index > 2) {
      return;
    }

    setSlots((prevSlots) => {
      const newSlots = [...prevSlots];
      newSlots[index] = slot;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSlots));
      } catch {
        // localStorage unavailable
      }

      return newSlots;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setSlots(DEFAULT_SLOTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return {
    slots,
    setSlot,
    availablePages: AVAILABLE_PAGES,
    resetToDefaults,
  };
}
