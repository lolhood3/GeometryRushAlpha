import { BUCKET, CELLS_PER_BEAT, Gate, Kind, Orb, Pad, Style } from './constants.ts';

export interface Theme {
  /** Sky gradient (top / horizon). */
  sky0: string;
  sky1: string;
  /** Structural colour: blocks, ground line. */
  accent: string;
  /** Secondary light: background geometry, pulses. */
  accent2: string;
  /** Everything that kills you. */
  hazard: string;
}

export type Difficulty = 'Easy' | 'Normal' | 'Hard' | 'Harder' | 'Insane';

export interface LevelMeta {
  id: string;
  index: number;
  name: string;
  tagline: string;
  difficulty: Difficulty;
  tier: number;
  stars: number;
  bpm: number;
  song: string;
  themes: Theme[];
  mechanics: string[];
}

export interface Obj {
  id: number;
  kind: number;
  /** Visual centre and full size. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Collision box (already includes travel range for moving hazards). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sub: number;
  v: number;
  style: number;
  /** Index into the per-attempt `used` array, -1 when stateless. */
  slot: number;
  mx: number;
  my: number;
  period: number;
  phase: number;
}

export interface SpeedSeg {
  beat: number;
  x: number;
  speed: number;
}

export type Trigger =
  | { kind: 'theme'; beat: number; x: number; theme: number }
  | { kind: 'text'; beat: number; x: number; text: string; sub: string }
  | { kind: 'zoom'; beat: number; x: number; zoom: number }
  | { kind: 'flash'; beat: number; x: number };

export interface Level {
  meta: LevelMeta;
  bpm: number;
  beatDur: number;
  objs: Obj[];
  buckets: number[][];
  bucketOrigin: number;
  gates: Obj[];
  segs: SpeedSeg[];
  triggers: Trigger[];
  pits: [number, number][];
  endBeat: number;
  endX: number;
  slots: number;
  shards: Obj[];
  /** Smallest x that still has ground/scenery. */
  minX: number;
  maxX: number;
}

export function xAtBeat(level: { segs: SpeedSeg[] }, beat: number): number {
  const segs = level.segs;
  let i = segs.length - 1;
  while (i > 0 && segs[i].beat > beat) i--;
  const s = segs[i];
  return s.x + (beat - s.beat) * CELLS_PER_BEAT * s.speed;
}

export function beatAtX(level: { segs: SpeedSeg[] }, x: number): number {
  const segs = level.segs;
  let i = segs.length - 1;
  while (i > 0 && segs[i].x > x) i--;
  const s = segs[i];
  return s.beat + (x - s.x) / (CELLS_PER_BEAT * s.speed);
}

/** Deterministic, engine-independent smooth oscillation in [-1, 1] with period 1. */
export function wobble(t: number): number {
  const s = t - Math.floor(t);
  const u = s < 0.5 ? s * 2 : 2 - s * 2;
  return (u * u * (3 - 2 * u)) * 2 - 1;
}

export interface SawMove {
  dx?: number;
  dy?: number;
  /** Beats per full cycle. */
  period?: number;
  phase?: number;
}

/** One call made on a `LevelBuilder` while a level was being written: the method and what it was given. */
export interface BuilderCall { op: string; args: unknown[] }
/** Everything one builder was asked to do, from `new LevelBuilder(...)` to `build()`. */
export interface BuilderTrace { meta: LevelMeta; speeds: [number, number][]; calls: BuilderCall[] }

let tracing: BuilderTrace[] | null = null;

/**
 * Runs `fn` and returns what every `LevelBuilder` made inside it was asked to
 * do. Only the calls the level's author wrote are listed, not the ones the
 * builder makes on itself. This is how a level written in TypeScript is
 * turned into a level document (see levels/format.ts).
 */
export function traceBuilders<T>(fn: () => T): { result: T; traces: BuilderTrace[] } {
  const before = tracing;
  const traces: BuilderTrace[] = [];
  tracing = traces;
  try {
    return { result: fn(), traces };
  } finally {
    tracing = before;
  }
}

/**
 * Level authoring DSL. Horizontal positions are given in *beats* – the builder
 * resolves them to cells through the speed map, so every object is placed
 * exactly where the player will be at that moment of the song.
 */
export class LevelBuilder {
  private objs: Obj[] = [];
  private pitsList: [number, number][] = [];
  private triggers: Trigger[] = [];
  readonly segs: SpeedSeg[] = [{ beat: 0, x: 0, speed: 1 }];
  private shardCount = 0;
  private endBeat = 0;
  private readonly meta: LevelMeta;

  constructor(meta: LevelMeta, speeds: [number, number][] = []) {
    this.meta = meta;
    for (const [beat, speed] of speeds) {
      const prev = this.segs[this.segs.length - 1];
      if (beat <= prev.beat) throw new Error('speed changes must be ascending and after beat 0');
      const x = prev.x + (beat - prev.beat) * CELLS_PER_BEAT * prev.speed;
      this.segs.push({ beat, x, speed });
      this.push(Kind.Gate, x, 1.5, 1.2, 3, Gate.Speed, speed);
    }
    if (tracing) {
      const trace: BuilderTrace = { meta, speeds: speeds.map(([b, v]) => [b, v]), calls: [] };
      tracing.push(trace);
      // Calls reach the builder through this wrapper, so a method that uses another one is seen from the outside only.
      let depth = 0;
      return new Proxy(this, {
        get(target, key, self) {
          const value = Reflect.get(target, key, self);
          if (typeof value !== 'function' || typeof key !== 'string') return value;
          return (...args: unknown[]) => {
            if (depth === 0) trace.calls.push({ op: key, args });
            depth++;
            try {
              return (value as (...a: unknown[]) => unknown).apply(self, args);
            } finally {
              depth--;
            }
          };
        },
      });
    }
  }

  /** Cell x of the player's centre at `beat`. */
  x(beat: number): number {
    return xAtBeat(this, beat);
  }

  private push(kind: number, x: number, y: number, w: number, h: number, sub = 0, v = 0, style = 0): Obj {
    const o = makeObj(kind, x, y, w, h, sub, v, style);
    this.objs.push(o);
    return o;
  }

  /** Solid from beat `b0` to `b1`, between heights y0..y1. */
  block(b0: number, b1: number, y0: number, y1: number, style: number = Style.Block): this {
    return this.rect(this.x(b0), this.x(b1), y0, y1, style);
  }

  /** Solid centred on `beat`, `w` cells wide. */
  blockAt(beat: number, w: number, y0: number, y1: number, style: number = Style.Block): this {
    const c = this.x(beat);
    return this.rect(c - w / 2, c + w / 2, y0, y1, style);
  }

  rect(x0: number, x1: number, y0: number, y1: number, style: number = Style.Block): this {
    this.push(Kind.Solid, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, 0, style);
    return this;
  }

  /** Thin platform (half a cell thick) whose top surface is at `top`. */
  slab(b0: number, b1: number, top: number): this {
    return this.block(b0, b1, top - 0.5, top, Style.Slab);
  }

  slabAt(beat: number, w: number, top: number): this {
    return this.blockAt(beat, w, top - 0.5, top, Style.Slab);
  }

  ceiling(b0: number, b1: number, y: number): this {
    return this.block(b0, b1, y, y + 16, Style.Ceiling);
  }

  /** `n` floor spikes centred on `beat`, standing on height `y`. */
  spikes(beat: number, n = 1, y = 0, small = false): this {
    return this.spikeRow(this.x(beat), n, y, 0, small);
  }

  /** `n` spikes hanging from a ceiling at height `y`. */
  spikesDown(beat: number, n = 1, y = 0, small = false): this {
    return this.spikeRow(this.x(beat), n, y, 1, small);
  }

  private spikeRow(cx: number, n: number, y: number, dir: number, small: boolean): this {
    const h = small ? 0.5 : 1;
    for (let i = 0; i < n; i++) {
      const x = cx - n / 2 + i + 0.5;
      const o = this.push(Kind.Spike, x, dir === 0 ? y + h / 2 : y - h / 2, 1, h, dir);
      const hh = small ? 0.28 : 0.56;
      o.x0 = x - 0.16;
      o.x1 = x + 0.16;
      if (dir === 0) { o.y0 = y; o.y1 = y + hh; } else { o.y0 = y - hh; o.y1 = y; }
    }
    return this;
  }

  /** Continuous strip of small spikes from beat b0..b1 (pit floors, corridor walls). */
  spikeStrip(b0: number, b1: number, y: number, down = false): this {
    const x0 = this.x(b0);
    const n = Math.max(1, Math.round(this.x(b1) - x0));
    return this.spikeRow(x0 + n / 2, n, y, down ? 1 : 0, true);
  }

  saw(beat: number, y: number, r = 1, move?: SawMove): this {
    const x = this.x(beat);
    const o = this.push(Kind.Saw, x, y, r * 2, r * 2, 0, r);
    if (move) {
      o.mx = move.dx ?? 0;
      o.my = move.dy ?? 0;
      o.period = move.period ?? 2;
      o.phase = move.phase ?? 0;
    }
    const ax = Math.abs(o.mx), ay = Math.abs(o.my);
    o.x0 = x - r - ax; o.x1 = x + r + ax; o.y0 = y - r - ay; o.y1 = y + r + ay;
    return this;
  }

  /**
   * Saw that bobs vertically in time with the music. It sits at `ySafe` at the
   * exact moment the player arrives and swings `2 * amp` away in between.
   */
  bobSaw(beat: number, ySafe: number, r = 1, amp = 1.3, period = 2): this {
    return this.saw(beat, ySafe - amp, r, { dy: amp, period, phase: 0.5 - beat / period });
  }

  pad(beat: number, y = 0, kind: number = Pad.Jump, ceiling = false): this {
    const o = this.push(Kind.Pad, this.x(beat), ceiling ? y - 0.15 : y + 0.15, 1, 0.3, kind, ceiling ? 1 : 0);
    o.x0 = o.x - 0.45; o.x1 = o.x + 0.45;
    if (ceiling) { o.y0 = y - 0.35; o.y1 = y; } else { o.y0 = y; o.y1 = y + 0.35; }
    return this;
  }

  gravPad(beat: number, y = 0, ceiling = false): this {
    return this.pad(beat, y, Pad.Gravity, ceiling);
  }

  orb(beat: number, y: number, kind: number = Orb.Jump): this {
    const o = this.push(Kind.Orb, this.x(beat), y, 1, 1, kind);
    o.x0 = o.x - 0.85; o.x1 = o.x + 0.85; o.y0 = y - 0.85; o.y1 = y + 0.85;
    return this;
  }

  gravOrb(beat: number, y: number): this {
    return this.orb(beat, y, Orb.Gravity);
  }

  /** Full-height gate that switches vehicle, gravity or size. `y` is only where the frame is drawn. */
  gate(beat: number, kind: number, y = 1.5): this {
    this.push(Kind.Gate, this.x(beat), y, 1.2, 3, kind);
    return this;
  }

  /**
   * Starts dual mode: a twin appears as the player's reflection in the line
   * y = `mirror`, falls the other way and answers the same button. Close it
   * with a `Gate.Solo` gate.
   */
  dual(beat: number, mirror: number, y = 1.5): this {
    this.push(Kind.Gate, this.x(beat), y, 1.2, 3, Gate.Dual, mirror);
    return this;
  }

  /** Ends dual mode. `mirror` is only used to draw the twin's half of the gate. */
  solo(beat: number, mirror: number, y = 1.5): this {
    this.push(Kind.Gate, this.x(beat), y, 1.2, 3, Gate.Solo, mirror);
    return this;
  }

  shard(beat: number, y: number): this {
    const o = this.push(Kind.Shard, this.x(beat), y, 0.9, 0.9, 0, this.shardCount++);
    o.x0 = o.x - 0.7; o.x1 = o.x + 0.7; o.y0 = y - 0.7; o.y1 = y + 0.7;
    return this;
  }

  /** Hole in the ground between two beats. */
  pit(b0: number, b1: number): this {
    this.pitsList.push([this.x(b0), this.x(b1)]);
    return this;
  }

  pitAt(beat: number, w: number): this {
    const c = this.x(beat);
    this.pitsList.push([c - w / 2, c + w / 2]);
    return this;
  }

  theme(beat: number, theme: number): this {
    this.triggers.push({ kind: 'theme', beat, x: this.x(beat), theme });
    return this;
  }

  text(beat: number, text: string, sub = ''): this {
    this.triggers.push({ kind: 'text', beat, x: this.x(beat), text, sub });
    return this;
  }

  zoom(beat: number, zoom: number): this {
    this.triggers.push({ kind: 'zoom', beat, x: this.x(beat), zoom });
    return this;
  }

  flash(beat: number): this {
    this.triggers.push({ kind: 'flash', beat, x: this.x(beat) });
    return this;
  }

  end(beat: number): this {
    this.endBeat = beat;
    return this;
  }

  build(): Level {
    if (this.endBeat <= 0) throw new Error(`${this.meta.id}: level has no end`);
    if (this.shardCount !== 3) throw new Error(`${this.meta.id}: expected 3 shards, got ${this.shardCount}`);
    return compileLevel({
      meta: this.meta, objs: this.objs, pits: this.pitsList, segs: this.segs, triggers: this.triggers, endBeat: this.endBeat,
    });
  }
}

/** Everything a level is made of before it is indexed for the simulation. Ground is not listed: it is whatever is not a pit. */
export interface LevelParts {
  meta: LevelMeta;
  objs: Obj[];
  pits: [number, number][];
  segs: SpeedSeg[];
  triggers: Trigger[];
  endBeat: number;
}

/** A blank object of the given kind, centred on (x, y). */
export function makeObj(kind: number, x: number, y: number, w: number, h: number, sub = 0, v = 0, style = 0): Obj {
  return {
    id: 0, kind, x, y, w, h,
    x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2,
    sub, v, style, slot: -1, mx: 0, my: 0, period: 1, phase: 0,
  };
}

/** Lays the ground, numbers the objects and builds the lookup tables the simulation runs on. */
export function compileLevel(parts: LevelParts): Level {
  const segs = parts.segs;
  const endX = xAtBeat({ segs }, parts.endBeat);
  const minX = -40;
  const maxX = endX + 48;
  const all = parts.objs.slice();

  // Ground = everything that is not a pit.
  const pits = parts.pits.slice().sort((a, b) => a[0] - b[0]);
  const ground = (x0: number, x1: number): void => {
    all.push(makeObj(Kind.Solid, (x0 + x1) / 2, -7, x1 - x0, 14, 0, 0, Style.Ground));
  };
  let cursor = minX;
  for (const [p0, p1] of pits) {
    if (p0 > cursor) ground(cursor, p0);
    cursor = Math.max(cursor, p1);
  }
  if (cursor < maxX) ground(cursor, maxX);

  const objs = all.sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
  let slots = 0;
  objs.forEach((o, i) => {
    o.id = i;
    if (o.kind === Kind.Pad || o.kind === Kind.Orb || o.kind === Kind.Shard) o.slot = slots++;
  });

  const bucketOrigin = Math.floor(minX / BUCKET);
  const count = Math.ceil(maxX / BUCKET) - bucketOrigin + 1;
  const buckets: number[][] = Array.from({ length: count }, () => []);
  for (const o of objs) {
    const b0 = Math.max(0, Math.floor(o.x0 / BUCKET) - bucketOrigin);
    const b1 = Math.min(count - 1, Math.floor(o.x1 / BUCKET) - bucketOrigin);
    for (let b = b0; b <= b1; b++) buckets[b].push(o.id);
  }

  const gates = objs.filter((o) => o.kind === Kind.Gate && o.sub !== Gate.Speed).sort((a, b) => a.x - b.x);
  const shards = objs.filter((o) => o.kind === Kind.Shard).sort((a, b) => a.v - b.v);
  const triggers = parts.triggers.slice().sort((a, b) => a.x - b.x);

  return {
    meta: parts.meta,
    bpm: parts.meta.bpm,
    beatDur: 60 / parts.meta.bpm,
    objs, buckets, bucketOrigin, gates,
    segs, triggers, pits,
    endBeat: parts.endBeat, endX, slots, shards, minX, maxX,
  };
}
