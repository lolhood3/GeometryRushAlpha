import type { Song } from '../../engine/audio/music.ts';
import { CELLS_PER_BEAT, Gate, Kind, Style } from '../sim/constants.ts';
import { compileLevel, makeObj, xAtBeat, type Level, type LevelMeta, type Obj, type SpeedSeg, type Trigger } from '../sim/level.ts';
import { Sim } from '../sim/sim.ts';

/**
 * Remixes: a track cut into the parts of its song and put back together in a
 * different order. The music is rearranged the same way, so every part still
 * plays over the bars it was built for.
 *
 * Nothing is redesigned. Each part keeps its obstacles, its speed and its
 * look; the only additions are gates at the joins, which put the player in the
 * vehicle, size and gravity the part was built to be entered in.
 */

const BEATS_PER_BAR = 4;
const EPS = 1e-6;

export interface Part {
  beat: number;
  endBeat: number;
}

/** The parts of a level: one per section of its song, the last one running to the finish line. */
export function partsOf(level: Level, song: Song): Part[] {
  const out: Part[] = [];
  let beat = 0;
  for (const s of song.sections) {
    if (beat >= level.endBeat - 1) break;
    out.push({ beat, endBeat: Math.min(level.endBeat, beat + s.bars * BEATS_PER_BAR) });
    beat += s.bars * BEATS_PER_BAR;
  }
  if (out.length === 0) out.push({ beat: 0, endBeat: level.endBeat });
  out[out.length - 1].endBeat = level.endBeat;
  return out;
}

/** What the reference run looks like as it crosses into a part. */
export interface Entry {
  mode: number;
  flipped: boolean;
  mini: boolean;
  dual: boolean;
}

/** Plays the reference run and notes the player's vehicle, gravity and size at the start of every part. */
export function entriesOf(level: Level, toggles: number[], parts: Part[]): Entry[] {
  const sim = new Sim(level);
  const out: Entry[] = [];
  let i = 0;
  let held = false;
  let next = 0;
  while (!sim.dead && !sim.won && next < parts.length) {
    if (sim.beat >= parts[next].beat) {
      out.push({ mode: sim.mode, flipped: sim.grav < 0, mini: sim.mini, dual: sim.dual });
      next++;
      continue;
    }
    while (i < toggles.length && toggles[i] <= sim.tick) { held = !held; i++; }
    sim.setInput(held);
    sim.step();
  }
  if (out.length !== parts.length) throw new Error(`${level.meta.id}: the reference run does not reach every part`);
  return out;
}

/** True when `order` keeps the first and last part in place and uses every part exactly once. */
export function isRemixOrder(order: number[], count: number): boolean {
  if (order.length !== count || order[0] !== 0 || order[count - 1] !== count - 1) return false;
  const seen = new Set(order);
  if (seen.size !== count) return false;
  for (const i of order) if (!Number.isInteger(i) || i < 0 || i >= count) return false;
  return true;
}

const speedAt = (segs: SpeedSeg[], beat: number): number => {
  let i = segs.length - 1;
  while (i > 0 && segs[i].beat > beat + EPS) i--;
  return segs[i].speed;
};

const VEHICLE_GATE = [Gate.Cube, Gate.Ship, Gate.Wave];

/**
 * Builds the level that results from playing the parts of `source` in `order`
 * (indices into `parts`). The first and last part must stay where they are.
 */
export function remixLevel(source: Level, parts: Part[], entries: Entry[], order: number[], meta: LevelMeta): Level {
  const n = parts.length;
  if (!isRemixOrder(order, n)) throw new Error(`${source.meta.id}: not a remix order: ${order.join(',')}`);
  for (const e of entries) if (e.dual) throw new Error(`${source.meta.id}: a part begins in dual mode and cannot be moved`);

  const srcX = parts.map((p) => xAtBeat(source, p.beat));
  const partOfX = (x: number): number => {
    let i = n - 1;
    while (i > 0 && x < srcX[i] - EPS) i--;
    return i;
  };
  const partOfBeat = (beat: number): number => {
    let i = n - 1;
    while (i > 0 && beat < parts[i].beat - EPS) i--;
    return i;
  };

  // The new timeline: where each part now starts, and the speed map that goes with it.
  const startBeat: number[] = new Array(n).fill(0);
  const segs: SpeedSeg[] = [];
  const pushSeg = (beat: number, speed: number): void => {
    const prev = segs[segs.length - 1];
    if (!prev) { segs.push({ beat: 0, x: 0, speed }); return; }
    if (prev.speed === speed) return;
    segs.push({ beat, x: prev.x + (beat - prev.beat) * CELLS_PER_BEAT * prev.speed, speed });
  };
  let at = 0;
  for (const i of order) {
    startBeat[i] = at;
    pushSeg(at, speedAt(source.segs, parts[i].beat));
    for (const s of source.segs) {
      if (s.beat > parts[i].beat + EPS && s.beat < parts[i].endBeat - EPS) pushSeg(at + s.beat - parts[i].beat, s.speed);
    }
    at += parts[i].endBeat - parts[i].beat;
  }
  const newX = parts.map((_, i) => xAtBeat({ segs }, startBeat[i]));
  const shift = (i: number): number => newX[i] - srcX[i];

  const objs: Obj[] = [];
  const moved = (o: Obj, dx: number): Obj => ({ ...o, x: o.x + dx, x0: o.x0 + dx, x1: o.x1 + dx });

  for (const o of source.objs) {
    if (o.kind === Kind.Solid && o.style === Style.Ground) continue; // laid again from the pits
    if (o.kind === Kind.Gate && o.sub === Gate.Speed) continue; // follows from the new speed map
    if (o.kind === Kind.Solid) {
      // A solid that runs across a join is cut there, and each piece goes with its part.
      const first = partOfX(o.x0);
      const last = partOfX(o.x1 - EPS);
      for (let i = first; i <= last; i++) {
        const x0 = Math.max(o.x0, i === 0 ? -Infinity : srcX[i]);
        const x1 = Math.min(o.x1, i === n - 1 ? Infinity : srcX[i + 1]);
        if (x1 - x0 < EPS) continue;
        // A ceiling that reaches a little way past its part is only overhang; on its own it would be a stray block.
        if (first !== last && o.style === Style.Ceiling && x1 - x0 < 4) continue;
        const dx = shift(i);
        objs.push({ ...o, x: (x0 + x1) / 2 + dx, w: x1 - x0, x0: x0 + dx, x1: x1 + dx });
      }
      continue;
    }
    const i = partOfX(o.x);
    const m = moved(o, shift(i));
    // A moving saw keeps time with the music: its swing is put back in step with its new place in the song.
    if (o.kind === Kind.Saw && (o.mx !== 0 || o.my !== 0)) m.phase = o.phase + (startBeat[i] - parts[i].beat) / o.period;
    objs.push(m);
  }

  // Speed gates, from the new map.
  for (let k = 1; k < segs.length; k++) objs.push(makeObj(Kind.Gate, segs[k].x, 1.5, 1.2, 3, Gate.Speed, segs[k].speed));

  // Joins: put the player in the state the part was built to be entered in.
  const hasGate = (i: number, sub: number): boolean =>
    source.gates.some((g) => g.sub === sub && g.x >= srcX[i] - EPS && g.x < srcX[i] + 0.5);
  for (let k = 1; k < n; k++) {
    const i = order[k];
    const before = order[k - 1];
    if (i === before + 1) continue; // these two were already neighbours
    const e = entries[i];
    const leaving = entries[before + 1]; // how the reference run leaves the part before the join
    const x = newX[i];
    if (!hasGate(i, VEHICLE_GATE[e.mode])) objs.push(makeObj(Kind.Gate, x, e.mode === 0 ? 1.5 : 2, 1.2, 3, VEHICLE_GATE[e.mode]));
    if (e.flipped && !hasGate(i, Gate.Flip)) objs.push(makeObj(Kind.Gate, x + 0.02, 1.5, 1.2, 3, Gate.Flip));
    if (e.mini !== leaving.mini && !hasGate(i, e.mini ? Gate.Mini : Gate.Big)) {
      objs.push(makeObj(Kind.Gate, x + 0.04, 1.5, 1.2, 3, e.mini ? Gate.Mini : Gate.Big));
    }
  }

  // Shards are numbered in the order they are met.
  objs.filter((o) => o.kind === Kind.Shard).sort((a, b) => a.x - b.x).forEach((o, k) => { o.v = k; });

  const pits: [number, number][] = [];
  for (const [p0, p1] of source.pits) {
    const first = partOfX(p0);
    const last = partOfX(p1 - EPS);
    for (let i = first; i <= last; i++) {
      const x0 = Math.max(p0, i === 0 ? -Infinity : srcX[i]);
      const x1 = Math.min(p1, i === n - 1 ? Infinity : srcX[i + 1]);
      if (x1 - x0 > EPS) pits.push([x0 + shift(i), x1 + shift(i)]);
    }
  }

  // Triggers move with their part. Text shown in the last beat of a part announces the next one, so it goes with that.
  const triggers: Trigger[] = [];
  const place = (t: Trigger, beat: number): Trigger => ({ ...t, beat, x: xAtBeat({ segs }, beat) });
  for (const t of source.triggers) {
    const i = partOfBeat(t.beat);
    const lead = parts[i].endBeat - t.beat;
    if (t.kind === 'text' && i < n - 1 && lead <= 1 + EPS) triggers.push(place(t, Math.max(0, startBeat[i + 1] - lead)));
    else triggers.push(place(t, startBeat[i] + t.beat - parts[i].beat));
  }
  // Each part keeps its own colours and zoom, whatever came before it in the new order.
  for (let k = 1; k < n; k++) {
    const i = order[k];
    if (i === order[k - 1] + 1) continue;
    const b = parts[i].beat;
    const own = (kind: Trigger['kind']): boolean => source.triggers.some((t) => t.kind === kind && Math.abs(t.beat - b) < EPS);
    let theme = 0;
    let zoom = 1;
    for (const t of source.triggers) {
      if (t.beat > b + EPS) continue;
      if (t.kind === 'theme') theme = t.theme; else if (t.kind === 'zoom') zoom = t.zoom;
    }
    if (!own('theme')) triggers.push({ kind: 'theme', beat: startBeat[i], x: newX[i], theme });
    if (!own('zoom')) triggers.push({ kind: 'zoom', beat: startBeat[i], x: newX[i], zoom });
  }

  return compileLevel({ meta, objs, pits, segs, triggers, endBeat: source.endBeat });
}

/** The song with its sections in the remix order. */
export function remixSong(song: Song, order: number[], id: string): Song {
  return { ...song, id, sections: order.map((i) => song.sections[i]) };
}

/**
 * The reference run of the source, rearranged the same way: in every part the
 * button is down exactly when it was in the original. It is a valid run of the
 * remix only where the joins allow it, which is what the stored orders are
 * checked for.
 */
export function remixReplay(source: Level, toggles: number[], parts: Part[], order: number[]): number[] {
  const tpb = (60 / source.bpm) * 240;
  const tickOf = (beat: number): number => Math.round(beat * tpb);
  const out: number[] = [];
  let held = false;
  let at = 0;
  for (const i of order) {
    const from = tickOf(parts[i].beat);
    const to = i === parts.length - 1 ? Infinity : tickOf(parts[i].endBeat);
    const base = tickOf(at) - from;
    // The button as the original run had it on entering this part.
    let k = 0;
    let down = false;
    while (k < toggles.length && toggles[k] < from) { down = !down; k++; }
    if (down !== held) { out.push(from + base); held = down; }
    for (; k < toggles.length && toggles[k] < to; k++) { out.push(toggles[k] + base); held = !held; }
    at += parts[i].endBeat - parts[i].beat;
  }
  return out;
}
