import { BUCKET, Kind, Mode, Style } from '../sim/constants.ts';
import type { Level } from '../sim/level.ts';
import { Sim, type Snapshot } from '../sim/sim.ts';

export interface SolveOptions {
  /** Decisions per beat while in cube mode (4 = 16th notes). */
  grid: number;
  /** Decisions per beat while flying. Must be a multiple of `grid`. */
  fine: number;
  /** Every press/release must also work this many beats early and late. */
  jitter: number;
  /** Extra hazard radius, so solutions never rely on pixel-perfect grazes. */
  hazardPad: number;
  /**
   * Spatial safety margin while flying. Time-shifted copies are meaningless for
   * continuously steered vehicles (a human corrects by feedback), so flight is
   * verified with fatter hazards and walls instead.
   */
  flightPad: number;
  requireShards: boolean;
  maxNodes: number;
}

export interface SolveResult {
  ok: boolean;
  /** Furthest beat reached by any explored branch. */
  maxBeat: number;
  nodes: number;
  /** Tick numbers at which the input toggles (starting from released). */
  toggles: number[];
  /** Where the deepest failed branch died (for level debugging). */
  death: string;
  jumps: number;
  syncRate: number;
}

export const DEFAULT_SOLVE: SolveOptions = {
  grid: 4, fine: 16, jitter: 0.06, hazardPad: 0.04, flightPad: 0.12, requireShards: true, maxNodes: 4_000_000,
};

interface Frame {
  slot: number;
  choices: number[];
  next: number;
  snaps: Snapshot[];
}

/**
 * Exhaustive depth-first search over held/released decisions on a rhythmic
 * grid. Several time-shifted copies of the simulation are advanced together;
 * a branch only survives when *all* copies survive, which proves the level is
 * beatable with human timing tolerance rather than frame-perfect inputs.
 */
export function solve(level: Level, options: Partial<SolveOptions> = {}): SolveResult {
  const opt = { ...DEFAULT_SOLVE, ...options };
  const offsets = opt.jitter > 0 ? [0, -opt.jitter, opt.jitter] : [0];
  const sims = offsets.map(() => {
    const s = new Sim(level);
    s.hazardPad = opt.hazardPad;
    s.requireShards = opt.requireShards;
    return s;
  });
  const tpb = 1 / sims[0].dB;
  const ratio = Math.round(opt.fine / opt.grid);
  const tickOf = (slot: number, k: number) => Math.max(0, Math.round((slot / opt.fine + offsets[k]) * tpb));

  const visited = new Set<string>();
  const stack: Frame[] = [];
  const path: number[] = [];
  let nodes = 0;
  let maxBeat = 0;
  let deathBeat = 0;
  let death = '';

  /** Centre of the widest opening in the first obstructed column ahead of `x`. */
  const openingAhead = (x: number): number => {
    for (let d = 1; d <= 12; d++) {
      const xa = x + d;
      const b = Math.floor(xa / BUCKET) - level.bucketOrigin;
      if (b < 0 || b >= level.buckets.length) return NaN;
      const blocked: [number, number][] = [];
      let floor = 0, ceil = 12, obstructed = false;
      for (const id of level.buckets[b]) {
        const o = level.objs[id];
        if (xa < o.x0 - 0.5 || xa > o.x1 + 0.5) continue;
        if (o.kind === Kind.Solid) {
          if (o.style === Style.Ground) floor = Math.max(floor, o.y1);
          else if (o.style === Style.Ceiling) ceil = Math.min(ceil, o.y0);
          else { blocked.push([o.y0, o.y1]); obstructed = true; }
        } else if (o.kind === Kind.Saw) {
          blocked.push([o.y - o.v, o.y + o.v]); obstructed = true;
        }
      }
      if (!obstructed) continue;
      blocked.push([-99, floor], [ceil, 99]);
      blocked.sort((a, c) => a[0] - c[0]);
      let best = NaN, bestSize = 0, top = blocked[0][1];
      for (let i = 1; i < blocked.length; i++) {
        const size = blocked[i][0] - top;
        if (size > bestSize) { bestSize = size; best = top + size / 2; }
        top = Math.max(top, blocked[i][1]);
      }
      return best;
    }
    return NaN;
  };

  /** Height the flight heuristics should steer towards, or NaN to simply hold altitude. */
  const flightTarget = (): number => {
    const p = sims[0];
    if (opt.requireShards) {
      for (const sh of level.shards) {
        if (p.shards & (1 << sh.v)) continue;
        const d = sh.x - p.x;
        if (d > -1 && d < 10) return sh.y;
      }
    }
    return openingAhead(p.x);
  };

  const choicesFor = (slot: number, prev: number): number[] => {
    const p = sims[0];
    if (p.mode === Mode.Cube) {
      if (slot % ratio !== 0) return [prev];
      return [0, 1];
    }
    const target = flightTarget();
    if (p.mode === Mode.Ship) {
      // PD steering: thrust "up" in gravity space when below the desired line.
      const want = Number.isNaN(target) ? -p.vy * p.grav : ((target - p.y) * 1.6 - p.vy) * p.grav;
      return want > 0 ? [1, 0] : [0, 1];
    }
    if (!Number.isNaN(target) && Math.abs(target - p.y) > 0.4) {
      return (target - p.y) * p.grav > 0 ? [1, 0] : [0, 1];
    }
    return prev ? [1, 0] : [0, 1];
  };

  const key = (slot: number): string => {
    let k = '' + slot;
    for (const s of sims) {
      const fly = s.mode !== Mode.Cube;
      k += '|' + Math.round(s.y * (fly ? 10 : 24)) + ',' + Math.round(s.vy * (fly ? 3 : 6)) + ',' + s.mode + (s.grav > 0 ? 'n' : 'f') +
        (s.held ? 'h' : '-') + (s.fresh ? 'r' : '-') + (s.grounded ? 'g' : '-') + (s.coyote > 0 ? 'c' : '-') + s.shards;
      let u = 0;
      for (let i = 0; i < s.used.length; i++) u = (u * 31 + s.used[i] * (i + 7)) | 0;
      k += ',' + u;
    }
    return k;
  };

  stack.push({ slot: 0, choices: choicesFor(0, 0), next: 0, snaps: sims.map((s) => s.save()) });

  while (stack.length > 0) {
    const f = stack[stack.length - 1];
    if (f.next >= f.choices.length) {
      stack.pop();
      continue;
    }
    if (++nodes > opt.maxNodes) break;
    const choice = f.choices[f.next++];
    let alive = true;
    let won = true;
    const flight = f.snaps[0].mode !== Mode.Cube;
    for (let k = 0; k < sims.length; k++) {
      const s = sims[k];
      const end = tickOf(f.slot + 1, k);
      if (flight && k > 0) {
        // Flying: follow the on-time copy exactly, then re-apply the timing offset.
        s.load(sims[0].save());
      } else {
        s.load(f.snaps[k]);
      }
      s.hazardPad = flight ? opt.flightPad : opt.hazardPad;
      s.solidPad = flight ? opt.flightPad * 0.5 : 0;
      s.setInput(choice === 1);
      while (s.tick < end && !s.dead && !s.won) s.step();
      if (s.dead) {
        alive = false;
        if (s.beat > deathBeat) {
          deathBeat = s.beat;
          death = `copy ${k} beat ${s.beat.toFixed(2)} x ${s.x.toFixed(2)} y ${s.y.toFixed(2)} vy ${s.vy.toFixed(2)} mode ${s.mode} grav ${s.grav}`;
        }
        break;
      }
      if (!s.won) won = false;
    }
    if (!alive) continue;
    const beat = sims[0].beat;
    if (beat > maxBeat) maxBeat = beat;
    path.length = stack.length - 1;
    path.push(choice);
    if (won) {
      // Rebuild toggle ticks for the on-time copy.
      const toggles: number[] = [];
      let prev = 0;
      for (let i = 0; i < path.length; i++) {
        if (path[i] !== prev) { toggles.push(tickOf(i, 0)); prev = path[i]; }
      }
      const p = sims[0];
      return { ok: true, maxBeat: level.endBeat, nodes, toggles, death: '', jumps: p.jumps, syncRate: p.actions ? p.synced / p.actions : 1 };
    }
    const kk = key(f.slot + 1);
    if (visited.has(kk)) continue;
    visited.add(kk);
    stack.push({ slot: f.slot + 1, choices: choicesFor(f.slot + 1, choice), next: 0, snaps: sims.map((s) => s.save()) });
  }
  return { ok: false, maxBeat, nodes, toggles: [], death, jumps: 0, syncRate: 0 };
}

/** Replays a toggle list and reports how the run ended. */
export function replay(level: Level, toggles: number[]): { won: boolean; beat: number; shards: number } {
  const s = new Sim(level);
  let i = 0;
  let held = false;
  const limit = Math.ceil((level.endBeat + 8) / s.dB);
  while (!s.dead && !s.won && s.tick < limit) {
    while (i < toggles.length && toggles[i] <= s.tick) { held = !held; i++; }
    s.setInput(held);
    s.step();
  }
  return { won: s.won, beat: s.beat, shards: s.shards };
}
