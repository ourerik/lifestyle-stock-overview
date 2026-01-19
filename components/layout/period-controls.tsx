'use client';

import { ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePeriod } from '@/providers/period-provider';
import type { PeriodType, ComparisonType } from '@/types';

const PERIOD_OPTIONS: { value: PeriodType; label: string; short: string }[] = [
  { value: 'last-7-days', label: 'Senaste 7 dagarna', short: '7 dagar' },
  { value: 'today', label: 'Idag', short: 'Idag' },
  { value: 'yesterday', label: 'Igår', short: 'Igår' },
  { value: 'week', label: 'Denna veckan', short: 'Vecka' },
  { value: 'last-week', label: 'Förra veckan', short: 'F. vecka' },
  { value: 'month', label: 'Denna månaden', short: 'Månad' },
  { value: 'last-month', label: 'Förra månaden', short: 'F. månad' },
  { value: 'year', label: 'Detta året', short: 'År' },
  { value: 'last-12-months', label: 'Senaste 12 mån', short: '12 mån' },
  { value: 'last-year', label: 'Förra året', short: 'F. år' },
];

const COMPARISON_OPTIONS: { value: ComparisonType; label: string; short: string }[] = [
  { value: 'period', label: 'Föregående period', short: 'vs period' },
  { value: 'year', label: 'Föregående år', short: 'vs år' },
];

interface PeriodControlsProps {
  lastUpdated?: Date | null;
  fromCache?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function PeriodControls({ lastUpdated, fromCache, isRefreshing, onRefresh }: PeriodControlsProps) {
  const { currentPeriod, comparisonType, setPeriod, setComparisonType } = usePeriod();

  const currentPeriodOption = PERIOD_OPTIONS.find((o) => o.value === currentPeriod);
  const currentComparisonOption = COMPARISON_OPTIONS.find((o) => o.value === comparisonType);

  const cacheLabel = lastUpdated
    ? `${fromCache ? 'Cache' : 'Ny'} ${lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
    : 'Laddar...';

  return (
    <div className="inline-flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-r-none gap-1 px-2.5 bg-white dark:bg-background"
          >
            {currentPeriodOption?.short}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup value={currentPeriod} onValueChange={(v) => setPeriod(v as PeriodType)}>
            {PERIOD_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none -ml-px gap-1 px-2.5 bg-white dark:bg-background"
          >
            {currentComparisonOption?.short}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={comparisonType} onValueChange={(v) => setComparisonType(v as ComparisonType)}>
            {COMPARISON_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        className="rounded-l-none -ml-px gap-1.5 px-2.5 bg-white dark:bg-background"
        onClick={onRefresh}
        disabled={isRefreshing}
        title="Uppdatera data"
      >
        <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        {cacheLabel}
      </Button>
    </div>
  );
}
