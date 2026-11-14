import { LEVEL_IDS } from '../levels/index.ts';
import { LATEST_RELEASE, findRelease, pendingNotice, unreadReleases, type Release } from '../updates/index.ts';
import { evaluateAchievements } from './achievements.ts';
import { CHASSIS, PAINTS, TRAILS, isUnlocked, starsEarned, unlockedCosmetics } from './cosmetics.ts';
import {
  STORAGE_KEY, completedCount, defaultProfile, importLegacy, isLevelUnlocked, sanitizeProfile, totalShards,
  type Loadout, type Profile, type Settings,
} from './profile.ts';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What a finished attempt (death, quit or win) contributes to the profile. */
export interface RunReport {
  levelId: string;
  practice: boolean;
  completed: boolean;
  /** False when the attempt was abandoned (restart / exit) rather than lost. */
  died: boolean;
  /** 0..1 furthest progress of this attempt. */
  progress: number;
  seconds: number;
  jumps: number;
  orbs: number;
  pads: number;
  actions: number;
  synced: number;
  bestStreak: number;
  /** Shards held when the run ended (only banked on a normal completion). */
  shards: number;
  /** Attempts made on this level since it was opened, including this one. */
  sessionAttempts: number;
}

export interface RunOutcome {
  newBest: boolean;
  previousBest: number;
  firstCompletion: boolean;
  newShards: number;
  achievements: string[];
  cosmetics: string[];
  unlockedLevel: string | null;
}

/** Where the save that an import, a reset or a restore replaced is kept. One slot. */
export const BACKUP_KEY = 'geometry_rush_v2_profile_backup';
/** Real saves are a few kilobytes; anything far beyond that is not one. */
export const MAX_SAVE_CHARS = 262144;

/** The handful of numbers that let a player recognise a save. */
export interface SaveSummary {
  cleared: number;
  tracks: number;
  stars: number;
  shards: number;
  achievements: number;
  attempts: number;
  playSeconds: number;
  createdAt: number;
}

export function summarizeSave(p: Profile): SaveSummary {
  return {
    cleared: completedCount(p), tracks: LEVEL_IDS.length, stars: starsEarned(p), shards: totalShards(p),
    achievements: Object.keys(p.achievements).length, attempts: p.totals.attempts, playSeconds: p.totals.playSeconds, createdAt: p.createdAt,
  };
}

/** True when a save holds nothing a player could miss. */
export function isBlankSave(p: Profile): boolean {
  return p.totals.attempts === 0 && p.totals.playSeconds === 0 && Object.keys(p.achievements).length === 0 && completedCount(p) === 0;
}

export type SaveProblem = 'empty' | 'too-large' | 'not-json' | 'not-a-save' | 'other-version';
export type SaveCheck = { ok: true; profile: Profile; summary: SaveSummary } | { ok: false; problem: SaveProblem };

/** Reads a save file without applying it, so it can be shown to the player before anything is replaced. */
export function checkSave(json: string): SaveCheck {
  if (typeof json !== 'string' || json.trim() === '') return { ok: false, problem: 'empty' };
  if (json.length > MAX_SAVE_CHARS) return { ok: false, problem: 'too-large' };
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return { ok: false, problem: 'not-json' }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, problem: 'not-a-save' };
  const r = parsed as Record<string, unknown>;
  if (!r.levels || typeof r.levels !== 'object' || !('version' in r)) return { ok: false, problem: 'not-a-save' };
  if (r.version !== 2) return { ok: false, problem: 'other-version' };
  const profile = sanitizeProfile(r);
  evaluateAchievements(profile);
  return { ok: true, profile, summary: summarizeSave(profile) };
}

export type RestoreReason = 'import' | 'reset' | 'restore';
/** The save that was replaced most recently, and why. */
export interface RestorePoint {
  at: number;
  reason: RestoreReason;
  summary: SaveSummary;
}

type Listener = () => void;

/**
 * Single source of truth for everything persistent. All mutations go through
 * here so saving, achievement checks and UI notifications cannot be skipped.
 */
export class ProfileStore {
  profile: Profile;
  /** True when progress cannot be written (private mode, quota…). */
  readOnly = false;
  private readonly storage: KeyValueStore | null;
  private readonly listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private point: { info: RestorePoint; profile: Profile } | null | undefined;
  /** Unlocked as the current attempt began, so the run that follows can still report it. */
  private early: { achievements: string[]; cosmetics: string[] } = { achievements: [], cosmetics: [] };

  constructor(storage: KeyValueStore | null) {
    this.storage = storage;
    this.profile = this.load();
  }

  private load(): Profile {
    const s = this.storage;
    if (!s) return defaultProfile();
    try {
      const raw = s.getItem(STORAGE_KEY);
      if (raw) {
        const p = sanitizeProfile(JSON.parse(raw));
        // A save whose numbers already meet a requirement is granted it on load, not at the next crash.
        evaluateAchievements(p);
        this.repairLoadout(p);
        return p;
      }
    } catch {
      /* fall through to a fresh profile */
    }
    const fresh = defaultProfile();
    importLegacy(fresh, (k) => s.getItem(k));
    // Whatever is unlocked on a brand new profile is not "new".
    fresh.seen = unlockedCosmetics(fresh);
    return fresh;
  }

  private repairLoadout(p: Profile): void {
    const ok = <T extends { id: string; unlock: Parameters<typeof isUnlocked>[0] }>(list: T[], id: string) => {
      const item = list.find((c) => c.id === id);
      return item && isUnlocked(item.unlock, p) ? id : list[0].id;
    };
    p.loadout.chassis = ok(CHASSIS, p.loadout.chassis);
    p.loadout.primary = ok(PAINTS, p.loadout.primary);
    p.loadout.secondary = ok(PAINTS, p.loadout.secondary);
    p.loadout.trail = ok(TRAILS, p.loadout.trail);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
    if (this.saveTimer === null) this.saveTimer = setTimeout(() => this.flush(), 250);
  }

  /** Writes immediately (also called on page hide). */
  flush(): void {
    if (this.saveTimer !== null) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      this.readOnly = false;
    } catch {
      this.readOnly = true;
    }
  }

  updateSettings(patch: Partial<Settings>): void {
    this.profile = { ...this.profile, settings: { ...this.profile.settings, ...patch } };
    this.changed();
  }

  /** Equips a cosmetic if it is unlocked. Returns whether it was applied. */
  equip(slot: keyof Loadout, id: string): boolean {
    const list = slot === 'chassis' ? CHASSIS : slot === 'trail' ? TRAILS : PAINTS;
    const item = list.find((c) => c.id === id);
    if (!item || !isUnlocked(item.unlock, this.profile)) return false;
    this.profile = { ...this.profile, loadout: { ...this.profile.loadout, [slot]: id } };
    this.changed();
    return true;
  }

  markSeen(keys: string[]): void {
    const fresh = keys.filter((k) => !this.profile.seen.includes(k));
    if (fresh.length === 0) return;
    this.profile = { ...this.profile, seen: [...this.profile.seen, ...fresh] };
    this.changed();
  }

  /** Cosmetics that are unlocked but have not been acknowledged yet. */
  unseen(): string[] {
    return unlockedCosmetics(this.profile).filter((k) => !this.profile.seen.includes(k));
  }

  /** Releases the player has not opened in Updates & News. */
  unreadNews(): Release[] {
    return unreadReleases(this.profile.news);
  }

  /** The release a What's New notice should be shown for, or null. */
  pendingNews(): Release | null {
    return pendingNotice(this.profile.news);
  }

  markReleaseViewed(id: string): void {
    const news = this.profile.news;
    if (!findRelease(id) || news.viewed.includes(id)) return;
    this.profile = { ...this.profile, news: { ...news, viewed: [...news.viewed, id] } };
    this.changed();
  }

  /** Records that the What's New notice for the current release has been shown, so it never returns. */
  acknowledgeNews(): void {
    const news = this.profile.news;
    if (news.notified === LATEST_RELEASE.id) return;
    this.profile = { ...this.profile, news: { ...news, notified: LATEST_RELEASE.id } };
    this.changed();
  }

  setLastLevel(id: string): void {
    if (this.profile.lastLevel === id) return;
    this.profile = { ...this.profile, lastLevel: id };
    this.changed();
  }

  /** Counts the start of an attempt. */
  beginAttempt(levelId: string, practice: boolean): void {
    const p = this.profile;
    const rec = p.levels[levelId];
    if (!rec) return;
    rec.attempts++;
    p.totals.attempts++;
    if (practice) p.totals.practiceRuns++;
    // Attempt counts change here, so the achievements that count attempts are checked here too.
    const before = unlockedCosmetics(p);
    const achievements = evaluateAchievements(p);
    this.early = { achievements, cosmetics: achievements.length ? unlockedCosmetics(p).filter((k) => !before.includes(k)) : [] };
    this.profile = { ...p };
    this.changed();
  }

  /** Folds a finished attempt into the profile and reports what it earned. */
  recordRun(r: RunReport): RunOutcome {
    const p = this.profile;
    const rec = p.levels[r.levelId];
    const before = unlockedCosmetics(p);
    const nextId = LEVEL_IDS[(LEVEL_IDS as readonly string[]).indexOf(r.levelId) + 1] ?? null;
    const nextWasLocked = nextId !== null && !isLevelUnlocked(p, nextId);
    const out: RunOutcome = {
      newBest: false, previousBest: r.practice ? rec.practiceBest : rec.best,
      firstCompletion: false, newShards: 0, achievements: [], cosmetics: [], unlockedLevel: null,
    };

    const t = p.totals;
    t.jumps += r.jumps;
    t.orbs += r.orbs;
    t.pads += r.pads;
    t.actions += r.actions;
    t.synced += r.synced;
    t.playSeconds += Math.max(0, r.seconds);
    if (!r.completed && r.died) t.deaths++;

    const pct = r.completed ? 100 : Math.min(99, Math.floor(r.progress * 100));
    if (r.practice) {
      if (pct > rec.practiceBest) { rec.practiceBest = pct; out.newBest = true; }
      if (r.completed) rec.practiceCompleted = true;
    } else {
      if (pct > rec.best) { rec.best = pct; out.newBest = true; }
      if (r.bestStreak > rec.bestStreak) rec.bestStreak = r.bestStreak;
      if (r.completed) {
        out.firstCompletion = !rec.completed;
        rec.completed = true;
        rec.completions++;
        t.completions++;
        const gained = r.shards & ~rec.shards;
        out.newShards = (gained & 1) + ((gained >> 1) & 1) + ((gained >> 2) & 1);
        rec.shards |= r.shards;
        const rate = r.actions > 0 ? r.synced / r.actions : 0;
        if (rate > rec.bestSync) rec.bestSync = rate;
        if (rec.fewestAttempts === 0 || r.sessionAttempts < rec.fewestAttempts) rec.fewestAttempts = r.sessionAttempts;
      }
    }

    out.achievements = [...this.early.achievements, ...evaluateAchievements(p)];
    const after = unlockedCosmetics(p);
    out.cosmetics = [...this.early.cosmetics, ...after.filter((k) => !before.includes(k))];
    this.early = { achievements: [], cosmetics: [] };
    if (nextWasLocked && nextId && isLevelUnlocked(p, nextId)) out.unlockedLevel = nextId;
    this.profile = { ...p };
    this.changed();
    return out;
  }

  exportSave(): string {
    return JSON.stringify(this.profile);
  }

  /**
   * Replaces the profile with imported data. Throws on unreadable input.
   * The save being replaced is kept as the restore point.
   */
  importSave(json: string): void {
    const check = checkSave(json);
    if (!check.ok) throw new Error(`Not a Geometry Rush V.2 save (${check.problem})`);
    const p = check.profile;
    this.repairLoadout(p);
    this.keepRestorePoint('import');
    // What has been read belongs to this player, not to the backup being restored.
    p.news = this.profile.news;
    this.profile = p;
    this.changed();
    this.flush();
  }

  /**
   * Wipes progress and cosmetics but keeps the player's settings.
   * The save being wiped is kept as the restore point.
   */
  resetProgress(): void {
    this.keepRestorePoint('reset');
    const fresh = defaultProfile();
    fresh.settings = this.profile.settings;
    fresh.veteran = this.profile.veteran;
    fresh.news = this.profile.news;
    fresh.seen = unlockedCosmetics(fresh);
    this.profile = fresh;
    this.changed();
    this.flush();
  }

  /** The save that the last import, reset or restore replaced, if one was kept. */
  restorePoint(): RestorePoint | null {
    return this.readPoint()?.info ?? null;
  }

  private readPoint(): { info: RestorePoint; profile: Profile } | null {
    if (this.point !== undefined) return this.point;
    this.point = null;
    try {
      const raw = this.storage?.getItem(BACKUP_KEY);
      if (!raw) return null;
      const r = JSON.parse(raw) as { at?: unknown; reason?: unknown; profile?: unknown };
      const check = checkSave(JSON.stringify(r.profile));
      if (!check.ok) return null;
      const reason: RestoreReason = r.reason === 'import' || r.reason === 'restore' ? r.reason : 'reset';
      const at = typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : 0;
      this.point = { info: { at, reason, summary: check.summary }, profile: check.profile };
    } catch {
      /* an unreadable restore point is treated as none */
    }
    return this.point;
  }

  /**
   * Copies the current save into the restore slot before it is replaced.
   * A save with nothing in it is not kept, so resetting twice cannot push
   * real progress out of the slot. Returns whether a copy was written.
   */
  private keepRestorePoint(reason: RestoreReason, now = Date.now()): boolean {
    if (!this.storage || isBlankSave(this.profile)) return false;
    try {
      this.storage.setItem(BACKUP_KEY, JSON.stringify({ at: now, reason, profile: this.profile }));
      this.point = undefined;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Brings back the save in the restore slot. The save it replaces takes its
   * place, so a restore can itself be undone. Returns false when there is
   * nothing to restore.
   */
  restorePrevious(): boolean {
    const point = this.readPoint();
    if (!point) return false;
    const p = point.profile;
    this.repairLoadout(p);
    p.news = this.profile.news;
    if (!this.keepRestorePoint('restore')) {
      // Nothing worth keeping in exchange: empty the slot so the same save is not offered twice.
      try { this.storage?.setItem(BACKUP_KEY, ''); } catch { /* the slot stays as it was */ }
      this.point = undefined;
    }
    this.profile = p;
    this.changed();
    this.flush();
    return true;
  }
}
