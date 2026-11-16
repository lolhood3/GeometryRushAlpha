import { Kind } from '../sim/constants.ts';
import type { Level } from '../sim/level.ts';
import type { KeyValueStore } from './store.ts';

/**
 * Ghosts: the player's best attempt at each track, kept as the list of ticks
 * on which the button changed. The simulation is deterministic, so replaying
 * that list through a second simulation reproduces the run exactly.
 *
 * Ghosts live under their own storage key. They belong to this device, they
 * are not part of an exported save, and losing them costs nothing but the
 * ghost.
 */
export const GHOST_KEY = 'geometry_rush_v2_ghosts';
/** A run with more button changes than this is not kept (about 25 per second for four minutes). */
export const MAX_GHOST_TOGGLES = 6000;
/** Bumped whenever the physics change in a way that makes old runs play out differently. */
export const SIM_VERSION = 2;

export interface Ghost {
  /** Identifies the level and physics the run was recorded on. */
  sig: string;
  /** How far the run got, 0..100. */
  percent: number;
  completed: boolean;
  /** Sync rate of the run, 0..1. */
  sync: number;
  /** Length of the run in simulation ticks. */
  ticks: number;
  /** Ticks on which the button changed, starting from released. */
  toggles: number[];
}

/** The part of a run that decides whether it replaces the stored one. */
export type GhostScore = Pick<Ghost, 'percent' | 'completed' | 'sync'>;

/**
 * A fingerprint of everything that decides how a run plays out. A ghost is
 * only shown on the exact level it was recorded on.
 */
export function levelSignature(level: Level): string {
  let h = 2166136261 ^ SIM_VERSION;
  const add = (n: number): void => {
    h ^= Math.round(n * 1000) | 0;
    h = Math.imul(h, 16777619);
  };
  for (const o of level.objs) {
    if (o.kind === Kind.Solid && o.y1 <= 0 && o.y0 < -10) continue;
    add(o.kind); add(o.sub); add(o.x0); add(o.y0); add(o.x1); add(o.y1); add(o.v); add(o.mx); add(o.my); add(o.period); add(o.phase);
  }
  for (const p of level.pits) { add(p[0]); add(p[1]); }
  for (const s of level.segs) { add(s.beat); add(s.speed); }
  add(level.endBeat);
  add(level.bpm);
  return `${level.meta.id}:${level.objs.length}:${(h >>> 0).toString(36)}`;
}

/** Whether run `a` should replace run `b`: further is better, and among clears the tighter sync wins. */
export function betterGhost(a: GhostScore, b: GhostScore | null): boolean {
  if (!b) return true;
  if (a.completed !== b.completed) return a.completed;
  if (a.completed) return a.sync > b.sync;
  return a.percent > b.percent;
}

interface Stored { sig: string; p: number; c: boolean; s: number; n: number; t: number[] }

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Toggle ticks are stored as the gaps between them, which keeps the numbers short. */
function pack(g: Ghost): Stored {
  const t: number[] = [];
  let prev = 0;
  for (const tick of g.toggles) { t.push(tick - prev); prev = tick; }
  return { sig: g.sig, p: g.percent, c: g.completed, s: Math.round(g.sync * 1000) / 1000, n: g.ticks, t };
}

function unpack(raw: unknown): Ghost | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.sig !== 'string' || r.sig.length > 96 || !Array.isArray(r.t) || r.t.length > MAX_GHOST_TOGGLES) return null;
  if (!isCount(r.n) || typeof r.p !== 'number' || typeof r.s !== 'number') return null;
  const toggles: number[] = [];
  let at = 0;
  for (const d of r.t) {
    if (!isCount(d)) return null;
    at += d;
    toggles.push(at);
  }
  if (at > r.n) return null;
  return {
    sig: r.sig, percent: Math.max(0, Math.min(100, Math.floor(r.p))), completed: r.c === true,
    sync: Math.max(0, Math.min(1, r.s)), ticks: r.n, toggles,
  };
}

export class GhostStore {
  private readonly storage: KeyValueStore | null;
  private ghosts: Record<string, Ghost> = {};

  constructor(storage: KeyValueStore | null) {
    this.storage = storage;
    try {
      const raw = storage?.getItem(GHOST_KEY);
      const parsed = raw ? JSON.parse(raw) as { ghosts?: Record<string, unknown> } : null;
      if (parsed && parsed.ghosts && typeof parsed.ghosts === 'object') {
        for (const [id, value] of Object.entries(parsed.ghosts)) {
          const g = unpack(value);
          if (g && id.length < 48) this.ghosts[id] = g;
        }
      }
    } catch {
      /* an unreadable ghost file is simply started again */
    }
  }

  private write(): void {
    if (!this.storage) return;
    const ghosts: Record<string, Stored> = {};
    for (const [id, g] of Object.entries(this.ghosts)) ghosts[id] = pack(g);
    try {
      this.storage.setItem(GHOST_KEY, JSON.stringify({ v: 1, ghosts }));
    } catch {
      /* out of space: the ghost stays for this session only */
    }
  }

  /** The stored run for a level, or null when there is none or it was recorded on another version of the level. */
  get(level: Level): Ghost | null {
    const g = this.ghosts[level.meta.id];
    return g && g.sig === levelSignature(level) ? g : null;
  }

  has(level: Level): boolean {
    return this.get(level) !== null;
  }

  /** Keeps a run if it beats the stored one. Returns whether it was kept. */
  offer(level: Level, run: Omit<Ghost, 'sig'>): boolean {
    if (run.toggles.length > MAX_GHOST_TOGGLES || run.ticks <= 0) return false;
    if (!betterGhost(run, this.get(level))) return false;
    this.ghosts[level.meta.id] = { ...run, toggles: run.toggles.slice(), sig: levelSignature(level) };
    this.write();
    return true;
  }

  drop(levelId: string): void {
    if (!(levelId in this.ghosts)) return;
    delete this.ghosts[levelId];
    this.write();
  }

  clear(): void {
    if (Object.keys(this.ghosts).length === 0) return;
    this.ghosts = {};
    this.write();
  }
}
