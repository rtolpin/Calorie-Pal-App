export type TimeFormat = '12h' | '24h';

/** Parses a "HH:MM" string into numeric hour (0-23) and minute (0-59). */
export function parseNotifTime(time: string): { hour: number; minute: number } {
  if (!time || !time.includes(':')) return { hour: 19, minute: 0 };
  const [rawH, rawM] = time.split(':');
  const h = Number(rawH);
  const m = Number(rawM);
  return {
    hour:   (isNaN(h) || rawH === '') ? 19 : Math.min(23, Math.max(0, h)),
    minute: (isNaN(m) || rawM === '') ?  0 : Math.min(59, Math.max(0, m)),
  };
}

/** Builds a "HH:MM" string (always 24-hour) from numeric hour and minute. */
export function buildNotifTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Returns the display hour for a given 24-hour value and format.
 * In 12h mode: hour 0 → 12, hours 1-11 → 1-11, hour 12 → 12, hours 13-23 → 1-11.
 * In 24h mode: returned unchanged.
 */
export function formatDisplayHour(hour: number, format: TimeFormat): number {
  if (format === '24h') return hour;
  const h = hour % 12;
  return h === 0 ? 12 : h;
}

/** Returns true when the 24-hour value is before noon (AM). */
export function isAmHour(hour: number): boolean {
  return hour < 12;
}

/**
 * Toggles between AM and PM by shifting the 24-hour value by ±12.
 * Hours 0-11 → 12-23 (switch to PM).
 * Hours 12-23 → 0-11 (switch to AM).
 */
export function toggleAmPm(hour: number): number {
  return hour < 12 ? hour + 12 : hour - 12;
}

/** Wraps hour adjustment within [0, 23]. */
export function adjustHour(current: number, delta: number): number {
  return (current + delta + 24) % 24;
}

/** Wraps minute adjustment within [0, 59]. */
export function adjustMinute(current: number, delta: number): number {
  return (current + delta + 60) % 60;
}
