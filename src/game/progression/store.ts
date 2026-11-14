import { LEVEL_IDS } from '../levels/index.ts';
import { LATEST_RELEASE, findRelease, pendingNotice, unreadReleases, type Release } from '../updates/index.ts';
import { evaluateAchievements } from './achievements.ts';
import { CHASSIS, PAINTS, TRAILS, isUnlocked, unlockedCosmetics } from './cosmetics.ts';
import {
  STORAGE_KEY, defaultProfile, importLegacy, isLevelUnlocked, sanitizeProfile,
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

    out.achievements = evaluateAchievements(p);
    const after = unlockedCosmetics(p);
    out.cosmetics = after.filter((k) => !before.includes(k));
    if (nextWasLocked && nextId && isLevelUnlocked(p, nextId)) out.unlockedLevel = nextId;
    this.profile = { ...p };
    this.changed();
    return out;
  }

  exportSave(): string {
    return JSON.stringify(this.profile);
  }

  /** Replaces the profile with imported data. Throws on unreadable input. */
  importSave(json: string): void {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 2) throw new Error('Not a Geometry Rush V.2 save');
    const p = sanitizeProfile(parsed);
    evaluateAchievements(p);
    this.repairLoadout(p);
    // What has been read belongs to this player, not to the backup being restored.
    p.news = this.profile.news;
    this.profile = p;
    this.changed();
    this.flush();
  }

  /** Wipes progress and cosmetics but keeps the player's settings. */
  resetProgress(): void {
    const fresh = defaultProfile();
    fresh.settings = this.profile.settings;
    fresh.veteran = this.profile.veteran;
    fresh.news = this.profile.news;
    fresh.seen = unlockedCosmetics(fresh);
    this.profile = fresh;
    this.changed();
    this.flush();
  }
}
