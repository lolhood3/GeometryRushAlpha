import { LEVEL_IDS } from '../levels/index.ts';

export type Quality = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  /** Extra audio/visual offset in milliseconds (latency calibration). */
  audioOffsetMs: number;
  quality: Quality;
  particles: boolean;
  shake: boolean;
  flashes: boolean;
  showFps: boolean;
  autoRetry: boolean;
  showProgress: boolean;
  showSync: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  haptics: boolean;
}

export interface LevelRecord {
  /** Best normal-mode progress, 0..100. */
  best: number;
  practiceBest: number;
  completed: boolean;
  practiceCompleted: boolean;
  attempts: number;
  completions: number;
  /** Bitmask of banked shards (banked by finishing a normal run). */
  shards: number;
  /** Best sync rate of a completed normal run, -1 when none. */
  bestSync: number;
  bestStreak: number;
  /** Fewest attempts needed in one sitting, 0 when never completed. */
  fewestAttempts: number;
}

export interface Totals {
  attempts: number;
  deaths: number;
  jumps: number;
  orbs: number;
  pads: number;
  actions: number;
  synced: number;
  playSeconds: number;
  completions: number;
  practiceRuns: number;
}

export interface Loadout {
  chassis: string;
  primary: string;
  secondary: string;
  trail: string;
}

export interface Profile {
  version: 2;
  createdAt: number;
  levels: Record<string, LevelRecord>;
  totals: Totals;
  loadout: Loadout;
  /** Achievement id → unlock timestamp. */
  achievements: Record<string, number>;
  /** Cosmetic ids the player has already been shown as unlocked. */
  seen: string[];
  settings: Settings;
  lastLevel: string;
  /** True when an Alpha-era (v1) save was found on this device. */
  veteran: boolean;
}

export const STORAGE_KEY = 'geometry_rush_v2_profile';

export function defaultSettings(): Settings {
  return {
    master: 0.8, music: 0.8, sfx: 0.8, muted: false, audioOffsetMs: 0,
    quality: 'auto', particles: true, shake: true, flashes: true, showFps: false,
    autoRetry: true, showProgress: true, showSync: true,
    reducedMotion: false, highContrast: false, haptics: true,
  };
}

export function emptyRecord(): LevelRecord {
  return {
    best: 0, practiceBest: 0, completed: false, practiceCompleted: false,
    attempts: 0, completions: 0, shards: 0, bestSync: -1, bestStreak: 0, fewestAttempts: 0,
  };
}

export function defaultProfile(now = Date.now()): Profile {
  const levels: Record<string, LevelRecord> = {};
  for (const id of LEVEL_IDS) levels[id] = emptyRecord();
  return {
    version: 2,
    createdAt: now,
    levels,
    totals: { attempts: 0, deaths: 0, jumps: 0, orbs: 0, pads: 0, actions: 0, synced: 0, playSeconds: 0, completions: 0, practiceRuns: 0 },
    loadout: { chassis: 'core', primary: 'cyan', secondary: 'ice', trail: 'line' },
    achievements: {},
    seen: [],
    settings: defaultSettings(),
    lastLevel: LEVEL_IDS[0],
    veteran: false,
  };
}

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, d: string): string => (typeof v === 'string' && v.length < 64 ? v : d);

/**
 * Rebuilds a valid profile from untrusted JSON. Unknown fields are dropped and
 * anything missing or malformed falls back to its default, so old or
 * hand-edited saves can never crash the game.
 */
export function sanitizeProfile(raw: unknown, now = Date.now()): Profile {
  const base = defaultProfile(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, any>;
  base.createdAt = num(r.createdAt, now, 0);
  base.veteran = bool(r.veteran, false);
  base.lastLevel = (LEVEL_IDS as readonly string[]).includes(r.lastLevel) ? r.lastLevel : base.lastLevel;

  if (r.levels && typeof r.levels === 'object') {
    for (const id of LEVEL_IDS) {
      const s = r.levels[id];
      if (!s || typeof s !== 'object') continue;
      const d = base.levels[id];
      d.completed = bool(s.completed, false);
      d.practiceCompleted = bool(s.practiceCompleted, false);
      d.best = d.completed ? 100 : Math.floor(num(s.best, 0, 0, 99));
      d.practiceBest = d.practiceCompleted ? 100 : Math.floor(num(s.practiceBest, 0, 0, 99));
      d.attempts = Math.floor(num(s.attempts, 0, 0));
      d.completions = Math.floor(num(s.completions, d.completed ? 1 : 0, 0));
      d.shards = d.completed ? Math.floor(num(s.shards, 0, 0, 7)) : 0;
      d.bestSync = d.completed ? num(s.bestSync, -1, -1, 1) : -1;
      d.bestStreak = Math.floor(num(s.bestStreak, 0, 0));
      d.fewestAttempts = d.completed ? Math.floor(num(s.fewestAttempts, 0, 0)) : 0;
    }
  }
  if (r.totals && typeof r.totals === 'object') {
    for (const k of Object.keys(base.totals) as (keyof Totals)[]) base.totals[k] = num(r.totals[k], 0, 0);
  }
  if (r.loadout && typeof r.loadout === 'object') {
    base.loadout.chassis = str(r.loadout.chassis, base.loadout.chassis);
    base.loadout.primary = str(r.loadout.primary, base.loadout.primary);
    base.loadout.secondary = str(r.loadout.secondary, base.loadout.secondary);
    base.loadout.trail = str(r.loadout.trail, base.loadout.trail);
  }
  if (r.achievements && typeof r.achievements === 'object') {
    for (const [k, v] of Object.entries(r.achievements)) {
      if (k.length < 48 && typeof v === 'number') base.achievements[k] = v;
    }
  }
  if (Array.isArray(r.seen)) base.seen = r.seen.filter((s: unknown) => typeof s === 'string' && s.length < 48).slice(0, 200);
  if (r.settings && typeof r.settings === 'object') {
    const s = r.settings;
    const d = base.settings;
    d.master = num(s.master, d.master, 0, 1);
    d.music = num(s.music, d.music, 0, 1);
    d.sfx = num(s.sfx, d.sfx, 0, 1);
    d.muted = bool(s.muted, d.muted);
    d.audioOffsetMs = Math.round(num(s.audioOffsetMs, 0, -150, 250));
    d.quality = ['auto', 'low', 'medium', 'high'].includes(s.quality) ? s.quality : d.quality;
    d.particles = bool(s.particles, d.particles);
    d.shake = bool(s.shake, d.shake);
    d.flashes = bool(s.flashes, d.flashes);
    d.showFps = bool(s.showFps, d.showFps);
    d.autoRetry = bool(s.autoRetry, d.autoRetry);
    d.showProgress = bool(s.showProgress, d.showProgress);
    d.showSync = bool(s.showSync, d.showSync);
    d.reducedMotion = bool(s.reducedMotion, d.reducedMotion);
    d.highContrast = bool(s.highContrast, d.highContrast);
    d.haptics = bool(s.haptics, d.haptics);
  }
  return base;
}

/** Carries over what still makes sense from an Alpha (v1) installation. */
export function importLegacy(profile: Profile, get: (key: string) => string | null): boolean {
  let found = false;
  try {
    const progress = get('geometry_rush_progress_v1');
    if (progress) {
      const parsed = JSON.parse(progress) as Record<string, { completed?: boolean }>;
      if (Object.values(parsed).some((p) => p && p.completed)) { profile.veteran = true; found = true; }
    }
    const settings = get('geometry_rush_settings_v1');
    if (settings) {
      const s = JSON.parse(settings) as Record<string, unknown>;
      const d = profile.settings;
      d.master = num(s.masterVolume, d.master, 0, 1);
      d.music = num(s.musicVolume, d.music, 0, 1);
      d.sfx = num(s.sfxVolume, d.sfx, 0, 1);
      d.muted = bool(s.isMuted, d.muted);
      d.shake = bool(s.screenShake, d.shake);
      d.flashes = bool(s.screenFlash, d.flashes);
      d.showFps = bool(s.showFps, d.showFps);
      d.reducedMotion = bool(s.reducedMotion, d.reducedMotion);
      d.haptics = bool(s.hapticsEnabled, d.haptics);
      found = true;
    }
  } catch {
    /* corrupt legacy data is simply ignored */
  }
  return found;
}

export function popcount3(mask: number): number {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}

export function totalShards(p: Profile): number {
  let n = 0;
  for (const id of LEVEL_IDS) n += popcount3(p.levels[id].shards);
  return n;
}

export function completedCount(p: Profile): number {
  let n = 0;
  for (const id of LEVEL_IDS) if (p.levels[id].completed) n++;
  return n;
}

export function isLevelUnlocked(p: Profile, id: string): boolean {
  const i = (LEVEL_IDS as readonly string[]).indexOf(id);
  if (i <= 0) return i === 0;
  const prev = p.levels[LEVEL_IDS[i - 1]];
  return prev.completed || prev.practiceCompleted;
}

export type SyncRank = 'S' | 'A' | 'B' | 'C' | 'D';

export function syncRank(rate: number): SyncRank {
  if (rate >= 0.9) return 'S';
  if (rate >= 0.75) return 'A';
  if (rate >= 0.55) return 'B';
  if (rate >= 0.35) return 'C';
  return 'D';
}
