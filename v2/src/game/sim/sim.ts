import {
  BUCKET, CELLS_PER_BEAT, COYOTE_BEATS, DT, Ev, Gate, GRAVITY, HALF, HAZARD_HALF, INNER, JUMP_V,
  KILL_HIGH, KILL_LOW, Kind, MAX_FALL, Mode, Orb, ORB_FLIP_V, Pad, PAD_FLIP_V, PAD_V, SHIP_DOWN,
  SHIP_MAX, SHIP_UP, SNAP, SYNC_WINDOW, WAVE_HALF, WAVE_INNER,
} from './constants.ts';
import { wobble, type Level, type Obj } from './level.ts';

export interface SimEvent {
  type: number;
  x: number;
  y: number;
  /** Event specific: sub-kind, sync flag, shard index… */
  a: number;
  b: number;
}

export interface Snapshot {
  tick: number;
  x: number; y: number; vy: number; rot: number;
  mode: number; grav: number;
  grounded: boolean; coyote: number; air: number;
  held: boolean; fresh: boolean;
  segIdx: number; gateIdx: number;
  shards: number;
  used: Uint8Array;
  jumps: number; actions: number; synced: number; streak: number; bestStreak: number; orbs: number; pads: number;
}

/**
 * Deterministic fixed-step player simulation. Contains no rendering, audio or
 * DOM access – the same class drives live play, practice checkpoints, the
 * attract-mode autopilot and the headless level verifier.
 */
export class Sim {
  readonly level: Level;
  /** Beats advanced per tick. */
  readonly dB: number;
  private readonly coyoteTicks: number;
  private readonly seen: Int32Array;
  private stamp = 0;

  tick = 0;
  x = 0; y = HALF; vy = 0; rot = 0;
  px = 0; py = HALF; prot = 0;
  mode: number = Mode.Cube;
  grav = 1;
  grounded = true;
  coyote = 0;
  /** Ticks spent airborne (drives landing feedback). */
  air = 0;
  held = false;
  fresh = false;
  dead = false;
  won = false;
  segIdx = 0;
  gateIdx = 0;
  shards = 0;
  used: Uint8Array;

  jumps = 0;
  actions = 0;
  synced = 0;
  streak = 0;
  bestStreak = 0;
  orbs = 0;
  pads = 0;

  /** Verifier knobs. */
  hazardPad = 0;
  solidPad = 0;
  requireShards = false;

  emit = false;
  readonly events: SimEvent[] = [];

  constructor(level: Level) {
    this.level = level;
    this.dB = DT / level.beatDur;
    this.coyoteTicks = Math.round(COYOTE_BEATS / this.dB);
    this.seen = new Int32Array(level.objs.length);
    this.used = new Uint8Array(level.slots);
    this.reset();
  }

  get beat(): number { return this.tick * this.dB; }
  get speed(): number { return this.level.segs[this.segIdx].speed; }
  get progress(): number { return Math.max(0, Math.min(1, this.x / this.level.endX)); }

  reset(): void {
    this.tick = 0;
    this.x = this.px = 0;
    this.y = this.py = HALF;
    this.vy = 0;
    this.rot = this.prot = 0;
    this.mode = Mode.Cube;
    this.grav = 1;
    this.grounded = true;
    this.coyote = 0;
    this.air = 0;
    this.held = false;
    this.fresh = false;
    this.dead = false;
    this.won = false;
    this.segIdx = 0;
    this.gateIdx = 0;
    this.shards = 0;
    this.used.fill(0);
    this.jumps = this.actions = this.synced = this.streak = this.bestStreak = this.orbs = this.pads = 0;
    this.events.length = 0;
  }

  save(): Snapshot {
    return {
      tick: this.tick, x: this.x, y: this.y, vy: this.vy, rot: this.rot,
      mode: this.mode, grav: this.grav, grounded: this.grounded, coyote: this.coyote, air: this.air,
      held: this.held, fresh: this.fresh, segIdx: this.segIdx, gateIdx: this.gateIdx,
      shards: this.shards, used: this.used.slice(),
      jumps: this.jumps, actions: this.actions, synced: this.synced, streak: this.streak,
      bestStreak: this.bestStreak, orbs: this.orbs, pads: this.pads,
    };
  }

  load(s: Snapshot): void {
    this.tick = s.tick; this.x = this.px = s.x; this.y = this.py = s.y; this.vy = s.vy;
    this.rot = this.prot = s.rot; this.mode = s.mode; this.grav = s.grav;
    this.grounded = s.grounded; this.coyote = s.coyote; this.air = s.air;
    this.held = s.held; this.fresh = s.fresh; this.segIdx = s.segIdx; this.gateIdx = s.gateIdx;
    this.shards = s.shards; this.used.set(s.used);
    this.jumps = s.jumps; this.actions = s.actions; this.synced = s.synced; this.streak = s.streak;
    this.bestStreak = s.bestStreak; this.orbs = s.orbs; this.pads = s.pads;
    this.dead = false; this.won = false;
    this.events.length = 0;
  }

  setInput(held: boolean): void {
    if (held === this.held) return;
    this.held = held;
    this.fresh = held;
  }

  private push(type: number, a = 0, b = 0): void {
    if (this.emit) this.events.push({ type, x: this.x, y: this.y, a, b });
  }

  /** Registers a rhythm action and returns 1 when it landed on the 8th-note grid. */
  private action(): number {
    const f = this.tick * this.dB * 2;
    const off = Math.abs(f - Math.round(f)) / 2;
    const hit = off <= SYNC_WINDOW ? 1 : 0;
    this.actions++;
    if (hit) {
      this.synced++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    } else {
      this.streak = 0;
    }
    return hit;
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    this.push(Ev.Death);
  }

  step(): void {
    if (this.dead || this.won) return;
    const L = this.level;
    const dB = this.dB;
    this.px = this.x; this.py = this.y; this.prot = this.rot;
    this.tick++;
    const beat = this.tick * dB;

    // Horizontal motion is a pure function of song time.
    const segs = L.segs;
    while (this.segIdx + 1 < segs.length && segs[this.segIdx + 1].beat <= beat) {
      this.segIdx++;
      this.push(Ev.Speed, segs[this.segIdx].speed);
    }
    const seg = segs[this.segIdx];
    const speed = seg.speed;
    const nx = seg.x + (beat - seg.beat) * CELLS_PER_BEAT * speed;

    const gates = L.gates;
    while (this.gateIdx < gates.length && gates[this.gateIdx].x <= nx) this.applyGate(gates[this.gateIdx++]);

    const g = this.grav;
    let acc = 0;
    if (this.mode === Mode.Cube) {
      if (this.held && (this.grounded || this.coyote > 0)) {
        this.vy = JUMP_V * g;
        this.grounded = false;
        this.coyote = 0;
        this.fresh = false;
        this.jumps++;
        this.push(Ev.Jump, this.action());
      }
      acc = -GRAVITY * g;
    } else if (this.mode === Mode.Ship) {
      acc = (this.held ? SHIP_UP : -SHIP_DOWN) * g;
    } else {
      this.vy = (this.held ? 1 : -1) * g * CELLS_PER_BEAT * speed;
    }

    const wasGrounded = this.grounded;
    this.x = nx;
    this.y += this.vy * dB + 0.5 * acc * dB * dB;
    this.vy += acc * dB;
    if (this.mode === Mode.Cube) {
      if (this.vy * g < -MAX_FALL) this.vy = -MAX_FALL * g;
    } else if (this.mode === Mode.Ship) {
      if (this.vy > SHIP_MAX) this.vy = SHIP_MAX; else if (this.vy < -SHIP_MAX) this.vy = -SHIP_MAX;
    }
    this.grounded = false;

    this.collide(beat);
    if (this.dead) return;

    if (this.grounded) {
      if (!wasGrounded && this.air > 12) this.push(Ev.Land, this.air);
      this.air = 0;
      this.coyote = 0;
    } else {
      if (wasGrounded && this.mode === Mode.Cube) this.coyote = this.coyoteTicks;
      else if (this.coyote > 0) this.coyote--;
      this.air++;
    }

    // Visual rotation lives in the sim so replays and interpolation agree.
    if (this.mode === Mode.Cube) {
      if (this.grounded) {
        const target = Math.round(this.rot / (Math.PI / 2)) * (Math.PI / 2);
        this.rot += (target - this.rot) * 0.3;
      } else {
        this.rot -= Math.PI * dB * g;
      }
    } else if (this.mode === Mode.Ship) {
      const target = Math.atan2(this.vy, CELLS_PER_BEAT * speed) * 0.9;
      this.rot += (target - this.rot) * 0.25;
    } else {
      const target = this.grounded ? 0 : (this.vy > 0 ? 1 : -1) * Math.PI / 4;
      this.rot += (target - this.rot) * 0.5;
    }

    if (this.y < KILL_LOW || this.y > KILL_HIGH) { this.die(); return; }

    if (this.requireShards) {
      const sh = L.shards;
      for (let i = 0; i < sh.length; i++) {
        if (!(this.shards & (1 << i)) && this.x > sh[i].x + 2) { this.die(); return; }
      }
    }

    if (this.x >= L.endX) {
      this.won = true;
      this.push(Ev.Win);
    }
  }

  private applyGate(o: Obj): void {
    const before = this.mode * 4 + (this.grav > 0 ? 0 : 1);
    // Vehicle gates always restore normal gravity, so a missed blue orb can
    // never leave the player inverted inside the next section.
    if (o.sub <= Gate.Wave && this.grav < 0) { this.grav = 1; this.grounded = false; }
    switch (o.sub) {
      case Gate.Cube:
        if (this.mode !== Mode.Cube) { this.mode = Mode.Cube; this.vy *= 0.5; this.grounded = false; }
        break;
      case Gate.Ship:
        if (this.mode !== Mode.Ship) { this.mode = Mode.Ship; this.vy *= 0.4; this.rot = 0; }
        break;
      case Gate.Wave:
        if (this.mode !== Mode.Wave) { this.mode = Mode.Wave; this.vy = 0; this.rot = 0; }
        break;
      case Gate.Flip:
        if (this.grav > 0) { this.grav = -1; this.vy *= 0.5; this.grounded = false; }
        break;
      case Gate.Unflip:
        if (this.grav < 0) { this.grav = 1; this.vy *= 0.5; this.grounded = false; }
        break;
    }
    const after = this.mode * 4 + (this.grav > 0 ? 0 : 1);
    if (after !== before) this.push(Ev.Gate, o.sub, o.id);
  }

  private collide(beat: number): void {
    const L = this.level;
    const wave = this.mode === Mode.Wave;
    const half = wave ? WAVE_HALF : HALF;
    const inner = (wave ? WAVE_INNER : INNER) + this.solidPad;
    const hz = (wave ? WAVE_HALF * 0.8 : HAZARD_HALF) + this.hazardPad;
    const x = this.x;
    const nb = L.buckets.length;
    let b0 = Math.floor((x - 1.6) / BUCKET) - L.bucketOrigin;
    let b1 = Math.floor((x + 1.6) / BUCKET) - L.bucketOrigin;
    if (b0 < 0) b0 = 0;
    if (b1 >= nb) b1 = nb - 1;
    const stamp = ++this.stamp;
    const seen = this.seen;
    const objs = L.objs;
    const slideBoth = this.mode !== Mode.Cube;

    // Pass 1 – solids: land, slide or die.
    for (let b = b0; b <= b1; b++) {
      const list = L.buckets[b];
      for (let i = 0; i < list.length; i++) {
        const o = objs[list[i]];
        if (o.kind !== Kind.Solid || seen[o.id] === stamp) continue;
        seen[o.id] = stamp;
        const y = this.y;
        if (x + half <= o.x0 || x - half >= o.x1 || y + half <= o.y0 || y - half >= o.y1) continue;
        if (this.vy <= 0 && this.py - half >= o.y1 - SNAP && (this.grav > 0 || slideBoth)) {
          this.y = o.y1 + half;
          this.vy = 0;
          if (this.grav > 0) this.grounded = true;
          continue;
        }
        if (this.vy >= 0 && this.py + half <= o.y0 + SNAP && (this.grav < 0 || slideBoth)) {
          this.y = o.y0 - half;
          this.vy = 0;
          if (this.grav < 0) this.grounded = true;
          continue;
        }
        if (x + inner > o.x0 && x - inner < o.x1 && y + inner > o.y0 && y - inner < o.y1) {
          this.die();
          return;
        }
      }
    }

    // Pass 2 – hazards and interactive objects.
    const y = this.y;
    for (let b = b0; b <= b1; b++) {
      const list = L.buckets[b];
      for (let i = 0; i < list.length; i++) {
        const o = objs[list[i]];
        if (o.kind === Kind.Solid || o.kind === Kind.Gate || seen[o.id] === stamp) continue;
        seen[o.id] = stamp;
        switch (o.kind) {
          case Kind.Spike:
            if (x + hz > o.x0 && x - hz < o.x1 && y + hz > o.y0 && y - hz < o.y1) { this.die(); return; }
            break;
          case Kind.Saw: {
            let cx = o.x, cy = o.y;
            if (o.mx !== 0 || o.my !== 0) {
              const w = wobble(beat / o.period + o.phase);
              cx += o.mx * w; cy += o.my * w;
            }
            const dx = Math.max(Math.abs(x - cx) - hz, 0);
            const dy = Math.max(Math.abs(y - cy) - hz, 0);
            const r = o.v * 0.82;
            if (dx * dx + dy * dy < r * r) { this.die(); return; }
            break;
          }
          case Kind.Pad:
            if (this.used[o.slot] === 0 && x + half > o.x0 && x - half < o.x1 && y + half > o.y0 && y - half < o.y1) {
              this.used[o.slot] = 1;
              this.pads++;
              if (o.sub === Pad.Jump) {
                this.vy = PAD_V * this.grav;
              } else {
                this.grav = -this.grav;
                this.vy = -PAD_FLIP_V * this.grav;
              }
              this.grounded = false;
              this.coyote = 0;
              this.push(Ev.Pad, o.sub, o.id);
            }
            break;
          case Kind.Orb:
            if (this.held && this.fresh && this.used[o.slot] === 0 &&
                x + half > o.x0 && x - half < o.x1 && y + half > o.y0 && y - half < o.y1) {
              this.used[o.slot] = 1;
              this.fresh = false;
              this.orbs++;
              if (o.sub === Orb.Jump) {
                this.vy = JUMP_V * this.grav;
              } else {
                this.grav = -this.grav;
                this.vy = -ORB_FLIP_V * this.grav;
              }
              this.grounded = false;
              this.coyote = 0;
              this.push(Ev.Orb, o.sub + this.action() * 16, o.id);
            }
            break;
          case Kind.Shard:
            if (this.used[o.slot] === 0 && x + half > o.x0 && x - half < o.x1 && y + half > o.y0 && y - half < o.y1) {
              this.used[o.slot] = 1;
              this.shards |= 1 << o.v;
              this.push(Ev.Shard, o.v, o.id);
            }
            break;
        }
      }
    }
  }
}

/** Position of a (possibly moving) saw at a given beat. */
export function sawCenter(o: Obj, beat: number, out: { x: number; y: number }): void {
  if (o.mx !== 0 || o.my !== 0) {
    const w = wobble(beat / o.period + o.phase);
    out.x = o.x + o.mx * w;
    out.y = o.y + o.my * w;
  } else {
    out.x = o.x;
    out.y = o.y;
  }
}
