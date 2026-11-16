/** Calendar days as keys (YYYY-MM-DD, local time), for the daily remix and its streak. */

const pad = (n: number): string => String(n).padStart(2, '0');

/** The local calendar day a moment falls on. */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Days since 1970-01-01 for a calendar day: consecutive days are consecutive numbers. */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function keyOfDay(day: number): string {
  const d = new Date(day * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** True for a string that names a real calendar day. */
export function isDateKey(key: unknown): key is string {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && keyOfDay(dayNumber(key)) === key;
}

/** The calendar day before `key`. */
export const previousKey = (key: string): string => keyOfDay(dayNumber(key) - 1);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "13 Nov" for a day key. */
export function shortDate(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
