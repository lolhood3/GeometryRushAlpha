import type { JSX } from 'preact';
import type { AchievementStatus } from '../../../game/progression/career.ts';

/**
 * One geometric mark per achievement, drawn on a 24-unit grid in the stroke
 * style of the game's other icons. `f` paths are filled, the rest are outlined.
 */
type Glyph = { d?: string; f?: string; dots?: [number, number, number][] };

const STAR = 'M12 3.2l2.6 5.6 5.9.7-4.4 4.1 1.2 6L12 16.6 6.7 19.6l1.2-6-4.4-4.1 5.9-.7z';

const GLYPHS: Record<string, Glyph> = {
  // Tracks
  'first-light': { d: 'M3 19h18M9 11h6v6H9zM12 3v3M5.2 6.2l2.1 2.1M18.8 6.2l-2.1 2.1' },
  momentum: { d: 'M4 6l6 6-6 6M11 6l6 6-6 6M18.5 9l2.5 3-2.5 3' },
  airborne: { d: 'M3 14.5L21 6l-6.5 13-3-5.5zM11.5 13.5L21 6M3 20h5' },
  superposition: { d: 'M4 4h11v11H4zM9 9h11v11H9z' },
  summit: { d: 'M2.5 20L10 8l3.5 5.5 2.5-3.5 5.5 10zM10 8V3h4.5l-1.2 1.6L14.5 6.2H10' },
  rehearsal: { d: 'M6 21V4h12l-3 4.5 3 4.5H6M10.5 17.5h8' },
  // Collection
  'collector-1': { d: 'M12 3l6 9-6 9-6-9z' },
  'collector-2': { d: 'M8 5l4.5 7L8 19l-4.5-7zM16 5l4.5 7-4.5 7-4.5-7z' },
  'collector-3': { d: 'M12 2l3.4 5.4L12 12.8 8.6 7.4zM6.5 11.2l3.4 5.4-3.4 5.4-3.4-5.4zM17.5 11.2l3.4 5.4-3.4 5.4-3.4-5.4z' },
  'half-way': { d: STAR },
  'all-stars': { f: STAR, d: 'M3 22h18' },
  // Rhythm
  'in-sync': { d: 'M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M12 8l4 4-4 4-4-4z' },
  'perfect-sync': { d: 'M8.5 21L10.8 3h2.4l2.3 18zM6 21h12M12 16.5L17.5 6' },
  streak: { d: 'M6 8l4 4-4 4-4-4zM12 8l4 4-4 4-4-4zM18 8l4 4-4 4-4-4z' },
  // Dedication
  'clean-run': { d: 'M5.5 9.5l4 4 9-10M4 18h3v3H4zM10.5 18h3v3h-3zM17 18h3v3h-3z' },
  persistent: { d: 'M19 12a7 7 0 11-2.2-5.1M19 4v4.5h-4.5' },
  relentless: { d: 'M19 12a7 7 0 11-2.2-5.1M19 4v4.5h-4.5M12 9.2l2.8 2.8-2.8 2.8L9.2 12z' },
  'frequent-flyer': { d: 'M3 18C6 5 18 5 21 18M10 16h4v4h-4z' },
  orbital: { d: 'M12 5a7 7 0 100 14 7 7 0 000-14z', dots: [[12, 12, 1.6], [17.4, 7.2, 2.2]] },
  marathon: { d: 'M12 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM9.5 2.5h5M12 2.5V6M12 13.5V9.5M12 13.5l3 2' },
};

const FALLBACK: Glyph = { d: 'M12 3l9 9-9 9-9-9z' };

export function Emblem({ id, status, size = 'md' }: { id: string; status: AchievementStatus; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
  const g = GLYPHS[id] ?? FALLBACK;
  return (
    <span class={`emblem emblem--${status} emblem--${size}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">
        {g.f && <path d={g.f} fill="currentColor" />}
        {g.d && <path d={g.d} />}
        {g.dots?.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />)}
      </svg>
    </span>
  );
}

/** Every achievement id that has its own mark (checked by the test suite against the definitions). */
export const EMBLEM_IDS = Object.keys(GLYPHS);
