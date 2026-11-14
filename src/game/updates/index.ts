import { FIRST_TRACKED_RELEASE, RELEASES } from './releases.ts';
import type { NewsState, Release, ReleaseCategory, ReleaseEra, ReleaseSection } from './types.ts';

export { RELEASES } from './releases.ts';
export type { NewsState, Release, ReleaseCategory, ReleaseEra, ReleaseSection } from './types.ts';

export const LATEST_RELEASE: Release = RELEASES[0];

/** Presentation key per category; the stylesheet maps it to a colour. */
export const CATEGORY_KEYS: Record<ReleaseCategory, string> = {
  'Major Update': 'major',
  'Minor Update': 'minor',
  Hotfix: 'hotfix',
  Improvement: 'improvement',
};

export interface EraInfo {
  id: ReleaseEra;
  label: string;
  /** Shown with every release of the era, when it needs explaining. */
  note?: string;
}

/** Eras in display order. */
export const ERAS: readonly EraInfo[] = [
  { id: 'v2', label: 'Geometry Rush V.2' },
  {
    id: 'original', label: 'Original game',
    note: 'Archived notes from the original Geometry Rush, kept as they were written. They describe that game, not V.2.',
  },
];

export const eraInfo = (id: ReleaseEra): EraInfo => ERAS.find((e) => e.id === id) ?? ERAS[0];

export const findRelease = (id: string): Release | undefined => RELEASES.find((r) => r.id === id);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-14" → "14 Nov 2026"; "2026-08" → "Aug 2026". Pass `long` for full month names. */
export function formatReleaseDate(date: string, long = false): string {
  const [y, m, d] = date.split('-').map(Number);
  const name = MONTHS[(m || 1) - 1] ?? '';
  const month = long ? name : name.slice(0, 3);
  return d ? `${d} ${month} ${y}` : `${month} ${y}`;
}

/** The standard note blocks that have content, followed by any extra ones. */
export function releaseSections(r: Release): (ReleaseSection & { kind: 'new' | 'improved' | 'fixed' | 'extra' })[] {
  const standard = [
    { kind: 'new' as const, title: 'What\'s New', items: r.features },
    { kind: 'improved' as const, title: 'Improvements', items: r.improvements },
    { kind: 'fixed' as const, title: 'Bug Fixes', items: r.fixes },
  ];
  const extra = (r.sections ?? []).map((s) => ({ kind: 'extra' as const, ...s }));
  return [...standard, ...extra].filter((s) => s.items.length > 0);
}

/** A new player has nothing to catch up on. */
export function caughtUpNews(): NewsState {
  return { viewed: RELEASES.map((r) => r.id), notified: LATEST_RELEASE.id };
}

/** State for a save written before the game tracked news: older releases are known, the rest is new. */
export function untrackedNews(): NewsState {
  const first = RELEASES.findIndex((r) => r.id === FIRST_TRACKED_RELEASE);
  return { viewed: first < 0 ? [] : RELEASES.slice(first + 1).map((r) => r.id), notified: null };
}

/** Rebuilds a valid state from untrusted save data. */
export function sanitizeNews(raw: unknown): NewsState {
  if (!raw || typeof raw !== 'object') return untrackedNews();
  const r = raw as Record<string, unknown>;
  const viewed = Array.isArray(r.viewed)
    ? [...new Set(r.viewed.filter((v): v is string => typeof v === 'string' && v.length < 48))].slice(0, 500)
    : [];
  return { viewed, notified: typeof r.notified === 'string' && r.notified.length < 48 ? r.notified : null };
}

/** Releases the player has not opened yet, newest first. */
export function unreadReleases(state: NewsState): Release[] {
  return RELEASES.filter((r) => !state.viewed.includes(r.id));
}

/** The release a What's New notice is owed for, if any: the latest one, once, unless it was already read. */
export function pendingNotice(state: NewsState): Release | null {
  if (state.notified === LATEST_RELEASE.id || state.viewed.includes(LATEST_RELEASE.id)) return null;
  return LATEST_RELEASE;
}
