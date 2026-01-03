'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePeriod } from '@/providers/period-provider';
import type { PeriodType } from '@/types';

interface PeriodOption {
  value: PeriodType;
  label: string;
  description: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: 'today', label: 'Idag', description: 'Jämfört med samma dag' },
  { value: 'week', label: 'Denna vecka', description: 'Jämfört med samma vecka' },
  { value: 'month', label: 'Denna månad', description: 'Jämfört med samma månad' },
  { value: 'last-week', label: 'Förra veckan', description: 'Jämfört med samma vecka' },
  { value: 'last-month', label: 'Förra månaden', description: 'Jämfört med samma månad' },
];

export function PeriodSelector() {
  const { currentPeriod, setPeriod } = usePeriod();

  const handleChange = (value: string) => {
    setPeriod(value as PeriodType);
  };

  return (
    <Select value={currentPeriod} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Välj period" />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { PERIOD_OPTIONS };
