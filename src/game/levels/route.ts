import { getSong } from '../music/songs.ts';
import { Kind, Mode, TICK_RATE } from '../sim/constants.ts';
import { xAtBeat, type Level } from '../sim/level.ts';
import { Sim, type Snapshot } from '../sim/sim.ts';
import { referenceReplay } from './daily.ts';
import { getLevel } from './index.ts';

/**
 * A track read as a route: the parts of its song, the vehicle the player is in
 * along the way, and a place to stand at the start of each part.
 *
 * Everything here is measured, not declared. The reference run for the level
 * is played through the simulation once and the result is kept, so the level
 * select, the progress bar and section practice all describe the track as it
 * actually plays.
 */

/** Where the reference run is at some moment: enough to carry on from there. */
export interface Cursor {
  snap: Snapshot;
  /** Next entry of the replay's toggle list. */
  idx: number;
  held: boolean;
}

export interface RouteSection {
  index: number;
  /** Part of the song: intro, build, drop, break or lift. */
  kind: string;
  /** Display name, numbered when a kind appears more than once: "Drop 2". */
  name: string;
  beat: number;
  endBeat: number;
  /** Position along the track, 0..1, on the same scale as the progress bar. */
  start: number;
  end: number;
  /** 0..1 intensity of the music here. */
  energy: number;
  /** Vehicles used in this part, in order of first use. */
  modes: number[];
  /**
   * A calm moment of the reference run shortly before this part begins. Section
   * practice and the level preview start from here.
   */
  cursor: Cursor;
}

export interface ModeSpan {
  mode: number;
  flipped: boolean;
  start: number;
  end: number;
}

export interface Route {
  levelId: string;
  sections: RouteSection[];
  /** Vehicle and gravity along the track, back to back from 0 to 1. */
  spans: ModeSpan[];
  /** Share of the run's time spent in each vehicle, indexed by Mode. Sums to 1. */
  share: number[];
  /** Times gravity turns over during the run. */
  flips: number;
  /** Slowest and fastest scroll speed. */
  speed: [number, number];
  hazards: number;
  orbs: number;
  pads: number;
}

export const MODE_NAME = ['Cube', 'Ship', 'Wave'] as const;

const KIND_NAME: Record<string, string> = { intro: 'Intro', build: 'Build', drop: 'Drop', break: 'Break', lift: 'Lift' };
const BEATS_PER_BAR = 4;
/** How far before a part the run-up may begin, in beats. */
const RUN_UP = 6;

function sectionPlan(level: Level): { kind: string; beat: number; endBeat: number; energy: number }[] {
  const out: { kind: string; beat: number; endBeat: number; energy: number }[] = [];
  let beat = 0;
  for (const s of getSong(level.meta.song).sections) {
    if (beat >= level.endBeat - 1) break;
    const end = Math.min(level.endBeat, beat + s.bars * BEATS_PER_BAR);
    out.push({ kind: s.name, beat, endBeat: end, energy: s.energy });
    beat += s.bars * BEATS_PER_BAR;
  }
  if (out.length === 0) out.push({ kind: 'intro', beat: 0, endBeat: level.endBeat, energy: 0.5 });
  out[out.length - 1].endBeat = level.endBeat;
  return out;
}

function named(plan: { kind: string }[]): string[] {
  const total = new Map<string, number>();
  for (const p of plan) total.set(p.kind, (total.get(p.kind) ?? 0) + 1);
  const seen = new Map<string, number>();
  return plan.map((p) => {
    const label = KIND_NAME[p.kind] ?? p.kind.charAt(0).toUpperCase() + p.kind.slice(1);
    if ((total.get(p.kind) ?? 0) < 2) return label;
    const n = (seen.get(p.kind) ?? 0) + 1;
    seen.set(p.kind, n);
    return `${label} ${n}`;
  });
}

/** Same rule the game uses before it drops a practice checkpoint. */
const steady = (s: Sim): boolean => (s.mode === Mode.Cube ? s.grounded : Math.abs(s.vy) < 2.5);

function trace(level: Level): Route {
  const toggles = referenceReplay(level.meta.id) ?? [];
  const plan = sectionPlan(level);
  const names = named(plan);
  const sim = new Sim(level);
  const beatTicks = 1 / sim.dB;
  const progressAt = (beat: number) => Math.max(0, Math.min(1, xAtBeat(level, beat) / level.endX));

  const sections: RouteSection[] = plan.map((p, i) => ({
    index: i, kind: p.kind, name: names[i], beat: p.beat, endBeat: p.endBeat,
    start: progressAt(p.beat), end: i === plan.length - 1 ? 1 : progressAt(p.endBeat),
    energy: p.energy, modes: [], cursor: { snap: sim.save(), idx: 0, held: false },
  }));

  const spans: ModeSpan[] = [{ mode: sim.mode, flipped: false, start: 0, end: 0 }];
  const ticksIn = [0, 0, 0];
  let flips = 0;
  let lo = sim.speed;
  let hi = sim.speed;
  let idx = 0;
  let held = false;
  let cur = 0;
  // The best place found so far to begin the next part, and how good it is.
  let next = 1;
  let grade = -1;
  let drift = 0;

  while (!sim.dead && !sim.won && sim.tick < 400000) {
    while (idx < toggles.length && toggles[idx] <= sim.tick) { held = !held; idx++; }

    if (next < sections.length) {
      const target = sections[next].beat;
      const beat = sim.beat;
      if (beat >= target - RUN_UP) {
        // Best: steady, hands off, and nothing to do for a beat. Then steady with hands off.
        // Then hands off and moving as little as possible. Failing all that, where the part begins.
        const quiet = !held && (idx >= toggles.length || toggles[idx] - sim.tick >= beatTicks);
        const calm = steady(sim);
        const g = beat >= target ? 0 : quiet && calm ? 3 : !held && calm ? 2 : !held && beat >= target - 2 ? 1 : -1;
        const v = Math.abs(sim.vy);
        // Among equally good moments the latest wins, except when none is steady: then the stillest does.
        if (g >= 0 && (g > grade || (g === grade && (g !== 1 || v <= drift)))) {
          grade = g;
          drift = v;
          sections[next].cursor = { snap: sim.save(), idx, held };
        }
        if (beat >= target) { next++; grade = -1; }
      }
    }

    while (cur < sections.length - 1 && sim.beat >= sections[cur].endBeat) cur++;
    if (!sections[cur].modes.includes(sim.mode)) sections[cur].modes.push(sim.mode);
    ticksIn[sim.mode]++;
    lo = Math.min(lo, sim.speed);
    hi = Math.max(hi, sim.speed);

    sim.setInput(held);
    sim.step();

    const last = spans[spans.length - 1];
    const flipped = sim.grav < 0;
    last.end = sim.progress;
    if (sim.mode !== last.mode || flipped !== last.flipped) {
      if (flipped !== last.flipped) flips++;
      spans.push({ mode: sim.mode, flipped, start: sim.progress, end: sim.progress });
    }
  }
  spans[spans.length - 1].end = 1;

  const all = ticksIn[0] + ticksIn[1] + ticksIn[2] || 1;
  let hazards = 0;
  let orbs = 0;
  let pads = 0;
  for (const o of level.objs) {
    if (o.kind === Kind.Spike || o.kind === Kind.Saw) hazards++;
    else if (o.kind === Kind.Orb) orbs++;
    else if (o.kind === Kind.Pad) pads++;
  }
  return {
    levelId: level.meta.id, sections, spans, share: ticksIn.map((n) => n / all), flips, speed: [lo, hi], hazards, orbs, pads,
  };
}

const cache = new WeakMap<Level, Route>();

/** The route of a level. Worked out on first use, then shared for as long as the level is the same one. */
export function routeOf(id: string): Route {
  const level = getLevel(id);
  let r = cache.get(level);
  if (!r) {
    r = trace(level);
    cache.set(level, r);
  }
  return r;
}

/** The part of the route that contains a position (0..1). */
export function sectionAt(route: Route, progress: number): RouteSection {
  const s = route.sections;
  let i = s.length - 1;
  while (i > 0 && s[i].start > progress) i--;
  return s[i];
}

/** Vehicles the track uses, most used first, with their share of the run. */
export function modeMix(route: Route): { mode: number; name: string; share: number }[] {
  return route.share
    .map((share, mode) => ({ mode, name: MODE_NAME[mode], share }))
    .filter((m) => m.share > 0)
    .sort((a, b) => b.share - a.share);
}

export interface PreviewWindow {
  section: number;
  /** Seconds into the song where the preview starts and stops. */
  from: number;
  to: number;
}

/** The stretch played on the level select: the run-up to the first drop and the drop itself. */
export function previewWindow(route: Route): PreviewWindow {
  const level = getLevel(route.levelId);
  const s = route.sections.find((x) => x.kind === 'drop' && x.index > 0)
    ?? route.sections.reduce((best, x) => (x.energy > best.energy ? x : best), route.sections[0]);
  return { section: s.index, from: s.cursor.snap.tick / TICK_RATE, to: s.endBeat * level.beatDur };
}

/**
 * The snapshot a practice run from a section starts on. The counters are
 * cleared so the run is judged on what the player does from here, and the
 * shards the reference run had picked up are not handed over.
 */
export function sectionStart(section: RouteSection): Snapshot {
  return {
    ...section.cursor.snap, used: section.cursor.snap.used.slice(),
    shards: 0, jumps: 0, actions: 0, synced: 0, streak: 0, bestStreak: 0, orbs: 0, pads: 0,
  };
}
