'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { usePeriod } from '@/providers/period-provider';
import { cn } from '@/lib/utils';
import type { PeriodType } from '@/types';

interface PeriodOption {
  value: PeriodType;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: 'last-7-days', label: 'Senaste 7 dagarna' },
  { value: 'today', label: 'Idag' },
  { value: 'yesterday', label: 'Igår' },
  { value: 'week', label: 'Denna veckan' },
  { value: 'last-week', label: 'Förra veckan' },
  { value: 'month', label: 'Denna månaden' },
  { value: 'last-month', label: 'Förra månaden' },
  { value: 'year', label: 'Detta året' },
  { value: 'last-12-months', label: 'Senaste 12 månaderna' },
  { value: 'last-year', label: 'Förra året' },
  { value: 'custom', label: 'Anpassa...' },
];

export function PeriodSelector() {
  const { currentPeriod, setPeriod, customDateRange, setCustomDateRange } = usePeriod();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tempFromDate, setTempFromDate] = useState<Date | undefined>(
    customDateRange?.from ? new Date(customDateRange.from) : undefined
  );
  const [tempToDate, setTempToDate] = useState<Date | undefined>(
    customDateRange?.to ? new Date(customDateRange.to) : undefined
  );

  const handleChange = (value: string) => {
    if (value === 'custom') {
      setIsDatePickerOpen(true);
    } else {
      setPeriod(value as PeriodType);
    }
  };

  const handleApplyCustomRange = () => {
    if (tempFromDate && tempToDate) {
      setCustomDateRange({
        from: format(tempFromDate, 'yyyy-MM-dd'),
        to: format(tempToDate, 'yyyy-MM-dd'),
      });
      setIsDatePickerOpen(false);
    }
  };

  const handleCancelCustomRange = () => {
    setIsDatePickerOpen(false);
    // Reset temp dates to stored custom range
    setTempFromDate(customDateRange?.from ? new Date(customDateRange.from) : undefined);
    setTempToDate(customDateRange?.to ? new Date(customDateRange.to) : undefined);
  };

  const getDisplayValue = () => {
    if (currentPeriod === 'custom' && customDateRange) {
      const fromStr = format(new Date(customDateRange.from), 'd MMM', { locale: sv });
      const toStr = format(new Date(customDateRange.to), 'd MMM', { locale: sv });
      return `${fromStr} - ${toStr}`;
    }
    return PERIOD_OPTIONS.find(opt => opt.value === currentPeriod)?.label || 'Välj period';
  };

  return (
    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
      <div className="flex items-center gap-2">
        <Select value={currentPeriod} onValueChange={handleChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue>{getDisplayValue()}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentPeriod === 'custom' && (
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        )}
      </div>

      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Från</p>
            <Calendar
              mode="single"
              selected={tempFromDate}
              onSelect={setTempFromDate}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Till</p>
            <Calendar
              mode="single"
              selected={tempToDate}
              onSelect={setTempToDate}
              disabled={(date) => date > new Date() || (tempFromDate ? date < tempFromDate : false)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleCancelCustomRange}>
              Avbryt
            </Button>
            <Button
              size="sm"
              onClick={handleApplyCustomRange}
              disabled={!tempFromDate || !tempToDate}
            >
              Tillämpa
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { PERIOD_OPTIONS };
