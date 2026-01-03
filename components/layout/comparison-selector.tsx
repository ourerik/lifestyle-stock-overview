'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePeriod } from '@/providers/period-provider';
import type { ComparisonType } from '@/types';

interface ComparisonOption {
  value: ComparisonType;
  label: string;
}

const COMPARISON_OPTIONS: ComparisonOption[] = [
  { value: 'period', label: 'Föregående period' },
  { value: 'year', label: 'Föregående år' },
];

export function ComparisonSelector() {
  const { comparisonType, setComparisonType } = usePeriod();

  const handleChange = (value: string) => {
    setComparisonType(value as ComparisonType);
  };

  return (
    <Select value={comparisonType} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Jämför med" />
      </SelectTrigger>
      <SelectContent>
        {COMPARISON_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { COMPARISON_OPTIONS };
