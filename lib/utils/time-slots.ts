import type { TimeSlot, TimeSlotId } from '@/types';

export const TIME_SLOTS: TimeSlot[] = [
  { id: 'night', label: '00-06', startHour: 0, endHour: 6 },
  { id: 'morning', label: '06-12', startHour: 6, endHour: 12 },
  { id: 'afternoon', label: '12-18', startHour: 12, endHour: 18 },
  { id: 'evening', label: '18-24', startHour: 18, endHour: 24 },
];

// Base colors for e-commerce (lighter)
export const ECOMMERCE_COLORS: Record<TimeSlotId, string> = {
  night: '#F2EAE0',     // light beige
  morning: '#F6C7B3',   // peach
  afternoon: '#C3DEDD', // light teal
  evening: '#82B2C0',   // dusty blue
};

// Darker variants for store/retail
export const STORE_COLORS: Record<TimeSlotId, string> = {
  night: '#D4C9BA',     // darker beige
  morning: '#E5A68E',   // darker peach
  afternoon: '#9BC5C3', // darker teal
  evening: '#5E919F',   // darker blue
};

/**
 * Get the time slot ID for a given hour (0-23)
 */
export function getTimeSlotFromHour(hour: number): TimeSlotId {
  if (hour >= 0 && hour < 6) return 'night';
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Get Swedish day label from a date
 */
export function getDayLabel(date: Date): string {
  return date.toLocaleDateString('sv-SE', { weekday: 'short' });
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}
