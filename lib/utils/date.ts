import type { PeriodType, ComparisonType, PeriodComparison, DateRange, CustomDateRange } from '@/types';

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

function startOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(0, 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(11, 31);
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatDateTimeForAPI(date: Date): string {
  const dateStr = formatDateForAPI(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${dateStr}T${hours}:${minutes}:${seconds}`;
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
    case 'last-7-days': {
      // Exactly 7 days (168 hours) from now
      const startDate = subDays(now, 7);

      // Comparison: 7 days before that
      const previousStart = comparisonType === 'year'
        ? subYears(startDate, 1)
        : subDays(startDate, 7);
      const previousEnd = comparisonType === 'year'
        ? subYears(now, 1)
        : subDays(now, 7);

      return {
        current: {
          start: formatDateTimeForAPI(startDate),
          end: formatDateTimeForAPI(now),
          displayLabel: 'Senaste 7 dagarna',
        },
        previous: {
          start: formatDateTimeForAPI(previousStart),
          end: formatDateTimeForAPI(previousEnd),
          displayLabel: comparisonType === 'year' ? 'Samma period förra året' : 'Föregående 7 dagar',
        },
      };
    }

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

    case 'yesterday': {
      const yesterday = subDays(today, 1);
      const previousDay = comparisonType === 'year'
        ? subYears(yesterday, 1)
        : subWeeks(yesterday, 1); // Same weekday last week

      return {
        current: {
          start: `${formatDateForAPI(yesterday)}T00:00:00`,
          end: `${formatDateForAPI(yesterday)}T23:59:59`,
          displayLabel: 'Igår',
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

    case 'year': {
      // This year (from Jan 1 to today)
      const yearStart = startOfYear(today);
      const dayOfYear = Math.floor((today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));

      const previousYearStart = subYears(yearStart, 1);
      const previousYearEnd = new Date(previousYearStart);
      previousYearEnd.setDate(previousYearEnd.getDate() + dayOfYear);

      return {
        current: {
          start: `${formatDateForAPI(yearStart)}T00:00:00`,
          end: `${formatDateForAPI(now)}T23:59:59`,
          displayLabel: 'Detta året',
        },
        previous: {
          start: `${formatDateForAPI(previousYearStart)}T00:00:00`,
          end: `${formatDateForAPI(previousYearEnd)}T23:59:59`,
          displayLabel: 'Förra året (samma period)',
        },
      };
    }

    case 'last-12-months': {
      // Last 12 months (rolling)
      const startDate = subMonths(startOfMonth(today), 11);

      const previousStart = comparisonType === 'year'
        ? subYears(startDate, 1)
        : subMonths(startDate, 12);
      const previousEnd = comparisonType === 'year'
        ? subYears(now, 1)
        : subMonths(now, 12);

      return {
        current: {
          start: `${formatDateForAPI(startDate)}T00:00:00`,
          end: `${formatDateForAPI(now)}T23:59:59`,
          displayLabel: 'Senaste 12 månaderna',
        },
        previous: {
          start: `${formatDateForAPI(previousStart)}T00:00:00`,
          end: `${formatDateForAPI(previousEnd)}T23:59:59`,
          displayLabel: comparisonType === 'year' ? 'Samma period förra året' : 'Föregående 12 månader',
        },
      };
    }

    case 'last-year': {
      // Last complete year
      const lastYearStart = startOfYear(subYears(today, 1));
      const lastYearEnd = endOfYear(lastYearStart);

      const previousYearStart = startOfYear(subYears(today, 2));
      const previousYearEnd = endOfYear(previousYearStart);

      const yearFormatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIMEZONE,
        year: 'numeric',
      });

      return {
        current: {
          start: `${formatDateForAPI(lastYearStart)}T00:00:00`,
          end: `${formatDateForAPI(lastYearEnd)}T23:59:59`,
          displayLabel: yearFormatter.format(lastYearStart),
        },
        previous: {
          start: `${formatDateForAPI(previousYearStart)}T00:00:00`,
          end: `${formatDateForAPI(previousYearEnd)}T23:59:59`,
          displayLabel: yearFormatter.format(previousYearStart),
        },
      };
    }

    case 'custom':
      // Custom period requires explicit date range via getCustomDateRange
      throw new Error('Custom period requires explicit date range. Use getCustomDateRange() instead.');

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

export function formatDateRangeShort(dateRange: { startDate: string; endDate: string }): string {
  const start = new Date(dateRange.startDate)
  const end = new Date(dateRange.endDate)
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}-${String(d.getFullYear()).slice(2)}`
  return `${fmt(start)} - ${fmt(end)}`
}

/**
 * Get date range for custom period with explicit from/to dates
 */
export function getCustomDateRange(
  customRange: CustomDateRange,
  comparisonType: ComparisonType = 'period'
): PeriodComparison {
  const fromDate = new Date(customRange.from);
  const toDate = new Date(customRange.to);

  // Calculate days difference for previous period
  const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

  let previousFrom: Date;
  let previousTo: Date;

  if (comparisonType === 'year') {
    previousFrom = subYears(fromDate, 1);
    previousTo = subYears(toDate, 1);
  } else {
    // Previous period of same length
    previousFrom = subDays(fromDate, daysDiff + 1);
    previousTo = subDays(fromDate, 1);
  }

  const dateRangeFormatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
  });

  const formatRange = (from: Date, to: Date) => {
    return `${dateRangeFormatter.format(from)} - ${dateRangeFormatter.format(to)}`;
  };

  return {
    current: {
      start: `${formatDateForAPI(fromDate)}T00:00:00`,
      end: `${formatDateForAPI(toDate)}T23:59:59`,
      displayLabel: formatRange(fromDate, toDate),
    },
    previous: {
      start: `${formatDateForAPI(previousFrom)}T00:00:00`,
      end: `${formatDateForAPI(previousTo)}T23:59:59`,
      displayLabel: formatRange(previousFrom, previousTo),
    },
  };
}
