import type { PeriodType, ComparisonType, PeriodComparison, DateRange } from '@/types';

const TIMEZONE = 'Europe/Stockholm';

function formatDateForAPI(date: Date): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function getStockholmDate(date: Date = new Date()): Date {
  // Get the current time in Stockholm
  const stockholmTime = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  return stockholmTime;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  // Monday = 1, so we need to adjust
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  result.setDate(0); // Last day of previous month
  result.setHours(23, 59, 59, 999);
  return result;
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function subWeeks(date: Date, weeks: number): Date {
  return subDays(date, weeks * 7);
}

function subMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function subYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() - years);
  return result;
}

export function getDateRange(
  period: PeriodType,
  comparisonType: ComparisonType = 'period',
  referenceDate: Date = new Date()
): PeriodComparison {
  const now = getStockholmDate(referenceDate);
  const today = startOfDay(now);

  switch (period) {
    case 'today': {
      // For 'today', we compare with same weekday last week (or last year)
      const previousDay = comparisonType === 'year'
        ? subYears(today, 1)
        : subWeeks(today, 1); // Same weekday last week

      return {
        current: {
          start: `${formatDateForAPI(today)}T00:00:00`,
          end: `${formatDateForAPI(now)}T23:59:59`,
          displayLabel: 'Idag',
        },
        previous: {
          start: `${formatDateForAPI(previousDay)}T00:00:00`,
          end: `${formatDateForAPI(previousDay)}T23:59:59`,
          displayLabel: comparisonType === 'year' ? 'Samma dag förra året' : 'Samma dag förra veckan',
        },
      };
    }

    case 'week': {
      const weekStart = startOfWeek(today);
      const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0

      let previousWeekStart: Date;
      let previousWeekEnd: Date;
      let label: string;

      if (comparisonType === 'year') {
        previousWeekStart = subYears(weekStart, 1);
        previousWeekEnd = new Date(previousWeekStart);
        previousWeekEnd.setDate(previousWeekStart.getDate() + dayOfWeek);
        label = 'Samma vecka förra året';
      } else {
        previousWeekStart = subWeeks(weekStart, 1);
        previousWeekEnd = new Date(previousWeekStart);
        previousWeekEnd.setDate(previousWeekStart.getDate() + dayOfWeek);
        label = 'Förra veckan';
      }

      return {
        current: {
          start: `${formatDateForAPI(weekStart)}T00:00:00`,
          end: `${formatDateForAPI(now)}T23:59:59`,
          displayLabel: 'Denna vecka',
        },
        previous: {
          start: `${formatDateForAPI(previousWeekStart)}T00:00:00`,
          end: `${formatDateForAPI(previousWeekEnd)}T23:59:59`,
          displayLabel: label,
        },
      };
    }

    case 'month': {
      const monthStart = startOfMonth(today);
      const dayOfMonth = today.getDate();

      let previousMonthStart: Date;
      let previousMonthEnd: Date;
      let label: string;

      if (comparisonType === 'year') {
        previousMonthStart = subYears(monthStart, 1);
        const previousMonthEndOfMonth = endOfMonth(previousMonthStart);
        previousMonthEnd = new Date(previousMonthStart);
        previousMonthEnd.setDate(Math.min(dayOfMonth, previousMonthEndOfMonth.getDate()));
        label = 'Samma månad förra året';
      } else {
        previousMonthStart = subMonths(monthStart, 1);
        const previousMonthEndOfMonth = endOfMonth(previousMonthStart);
        previousMonthEnd = new Date(previousMonthStart);
        previousMonthEnd.setDate(Math.min(dayOfMonth, previousMonthEndOfMonth.getDate()));
        label = 'Förra månaden';
      }

      return {
        current: {
          start: `${formatDateForAPI(monthStart)}T00:00:00`,
          end: `${formatDateForAPI(now)}T23:59:59`,
          displayLabel: 'Denna månad',
        },
        previous: {
          start: `${formatDateForAPI(previousMonthStart)}T00:00:00`,
          end: `${formatDateForAPI(previousMonthEnd)}T23:59:59`,
          displayLabel: label,
        },
      };
    }

    case 'last-week': {
      const thisWeekStart = startOfWeek(today);
      const lastWeekStart = subWeeks(thisWeekStart, 1);
      const lastWeekEnd = subDays(thisWeekStart, 1);

      let previousWeekStart: Date;
      let previousWeekEnd: Date;
      let label: string;

      if (comparisonType === 'year') {
        previousWeekStart = subYears(lastWeekStart, 1);
        previousWeekEnd = subYears(lastWeekEnd, 1);
        label = 'Samma vecka förra året';
      } else {
        previousWeekStart = subWeeks(lastWeekStart, 1);
        previousWeekEnd = subDays(lastWeekStart, 1);
        label = 'Veckan innan';
      }

      return {
        current: {
          start: `${formatDateForAPI(lastWeekStart)}T00:00:00`,
          end: `${formatDateForAPI(lastWeekEnd)}T23:59:59`,
          displayLabel: 'Förra veckan',
        },
        previous: {
          start: `${formatDateForAPI(previousWeekStart)}T00:00:00`,
          end: `${formatDateForAPI(previousWeekEnd)}T23:59:59`,
          displayLabel: label,
        },
      };
    }

    case 'last-month': {
      const thisMonthStart = startOfMonth(today);
      const lastMonthStart = subMonths(thisMonthStart, 1);
      const lastMonthEnd = endOfMonth(lastMonthStart);

      let previousMonthStart: Date;
      let previousMonthEnd: Date;
      let label: string;

      const monthFormatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIMEZONE,
        month: 'long',
        year: 'numeric',
      });

      if (comparisonType === 'year') {
        previousMonthStart = subYears(lastMonthStart, 1);
        previousMonthEnd = endOfMonth(previousMonthStart);
        label = monthFormatter.format(previousMonthStart);
      } else {
        previousMonthStart = subMonths(lastMonthStart, 1);
        previousMonthEnd = endOfMonth(previousMonthStart);
        label = monthFormatter.format(previousMonthStart);
      }

      return {
        current: {
          start: `${formatDateForAPI(lastMonthStart)}T00:00:00`,
          end: `${formatDateForAPI(lastMonthEnd)}T23:59:59`,
          displayLabel: monthFormatter.format(lastMonthStart),
        },
        previous: {
          start: `${formatDateForAPI(previousMonthStart)}T00:00:00`,
          end: `${formatDateForAPI(previousMonthEnd)}T23:59:59`,
          displayLabel: label,
        },
      };
    }

    default:
      throw new Error(`Unknown period type: ${period}`);
  }
}

export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
