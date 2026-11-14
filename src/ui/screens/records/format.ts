const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "6 Nov 2026", in the player's own time zone. */
export function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "6 Nov", or with the year when it is not this year. */
export function formatShortDay(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const short = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? short : `${short} ${d.getFullYear()}`;
}

/** "6 Nov 2026, 21:04". */
export function formatMoment(ms: number): string {
  const d = new Date(ms);
  return `${formatDay(ms)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const count = (n: number): string => n.toLocaleString('en-US');
