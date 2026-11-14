import { mix, pack, type RGB } from '../../engine/gfx/color.ts';
import { Shape, type Renderer } from '../../engine/gfx/renderer.ts';
import { BUCKET, Gate, Kind, Orb, Pad, Style } from '../sim/constants.ts';
import { beatAtX, xAtBeat, type Level, type Obj } from '../sim/level.ts';
import { sawCenter } from '../sim/sim.ts';
import type { Palette } from './theme.ts';

const YELLOW: RGB = [1, 0.86, 0.26];
const BLUE: RGB = [0.3, 0.8, 1];
const GREEN: RGB = [0.45, 1, 0.5];
const PINK: RGB = [1, 0.42, 0.84];
const ORANGE: RGB = [1, 0.6, 0.2];
const WHITE: RGB = [1, 1, 1];
const DARK: RGB = [0.02, 0.03, 0.06];

export function gateColor(sub: number, v: number): RGB {
  switch (sub) {
    case Gate.Cube: return GREEN;
    case Gate.Ship: return PINK;
    case Gate.Wave: return BLUE;
    case Gate.Flip: return YELLOW;
    case Gate.Unflip: return BLUE;
    default: return v >= 1.45 ? PINK : v >= 1.2 ? ORANGE : GREEN;
  }
}
export const padColor = (sub: number): RGB => (sub === Pad.Gravity ? BLUE : YELLOW);
export const orbColor = (sub: number): RGB => (sub === Orb.Gravity ? BLUE : YELLOW);

export interface WorldView {
  level: Level;
  /** Per-attempt consumption flags (pads, orbs, shards). */
  used: Uint8Array;
  beat: number;
  time: number;
  pulse: number;
  left: number;
  right: number;
  palette: Palette;
}

const tmp = { x: 0, y: 0 };
const c0: RGB = [0, 0, 0];
const c1: RGB = [0, 0, 0];

/** Draws every visible level object. Three passes keep a stable paint order. */
export class WorldRenderer {
  private seen = new Int32Array(0);
  private stamp = 0;
  private level: Level | null = null;

  draw(r: Renderer, v: WorldView): void {
    const L = v.level;
    if (this.level !== L) {
      this.level = L;
      this.seen = new Int32Array(L.objs.length);
      this.stamp = 0;
    }
    const p = v.palette;
    const pulse = v.pulse;
    const nb = L.buckets.length;
    const b0 = Math.max(0, Math.floor((v.left - 3) / BUCKET) - L.bucketOrigin);
    const b1 = Math.min(nb - 1, Math.floor((v.right + 3) / BUCKET) - L.bucketOrigin);

    const groundFill = pack(mix(p.sky0, p.sky1, 0.22, c0));
    const accent = pack(p.accent);
    const accentSoft = pack(p.accent, 0.16);
    const blockFill = pack(mix(p.sky0, p.accent, 0.09, c0), 0.94);
    const slabFill = pack(mix(p.sky0, p.accent, 0.2, c0), 0.96);
    const hazard = pack(p.hazard);
    const hazardFill = pack(mix(DARK, p.hazard, 0.16, c0));
    const glow = 0.28 + pulse * 0.35;

    // ── Pass 1: ground and structure ─────────────────────────────────────
    let stamp = ++this.stamp;
    for (let b = b0; b <= b1; b++) {
      const list = L.buckets[b];
      for (let i = 0; i < list.length; i++) {
        const o = L.objs[list[i]];
        if (o.kind !== Kind.Solid || this.seen[o.id] === stamp) continue;
        this.seen[o.id] = stamp;
        const hw = o.w / 2, hh = o.h / 2;
        if (o.style === Style.Ground) {
          r.shape(Shape.Box, o.x, o.y, hw, hh, 0, groundFill, 0);
          r.shape(Shape.Fade, o.x, -1.3, hw, 1.3, 0, accentSoft, 0, 0, 0, 0, 1.6);
          r.shape(Shape.Box, o.x, -0.035, hw, 0.035, 0, accent, accent, 0, 0.55, 0.45 + pulse * 0.5);
        } else if (o.style === Style.Slab) {
          r.shape(Shape.Box, o.x, o.y, hw, hh, 0, slabFill, accent, 0.07, 0.4, glow + 0.1, 0.12);
        } else {
          r.shape(Shape.Block, o.x, o.y, hw, hh, 0, blockFill, accent, 0.06, 0.35, glow, 0.05);
        }
      }
    }

    // Beat ruler along the ground: the level's rhythm made visible.
    const kb0 = Math.max(0, Math.ceil(beatAtX(L, v.left - 1) * 2));
    const kb1 = Math.min(L.endBeat * 2, Math.floor(beatAtX(L, v.right + 1) * 2));
    for (let k = kb0; k <= kb1; k++) {
      const x = xAtBeat(L, k / 2);
      let inPit = false;
      for (const pit of L.pits) if (x > pit[0] - 0.1 && x < pit[1] + 0.1) { inPit = true; break; }
      if (inPit) continue;
      const bar = k % 8 === 0;
      const whole = k % 2 === 0;
      const near = Math.max(0, 1 - Math.abs(k / 2 - v.beat) * 1.4);
      const a = (whole ? (bar ? 0.75 : 0.42) : 0.16) + near * 0.5;
      const hh = bar ? 0.26 : whole ? 0.15 : 0.07;
      r.shape(Shape.Box, x, -0.2 - hh, 0.03, hh, 0, pack(p.accent, Math.min(1, a)), accent, 0, 0.2, near * 0.6);
    }

    // ── Pass 2: hazards ──────────────────────────────────────────────────
    stamp = ++this.stamp;
    for (let b = b0; b <= b1; b++) {
      const list = L.buckets[b];
      for (let i = 0; i < list.length; i++) {
        const o = L.objs[list[i]];
        if ((o.kind !== Kind.Spike && o.kind !== Kind.Saw) || this.seen[o.id] === stamp) continue;
        this.seen[o.id] = stamp;
        if (o.kind === Kind.Spike) {
          r.shape(Shape.Tri, o.x, o.y, 0.44, o.h / 2 - 0.03, o.sub === 1 ? Math.PI : 0,
            hazardFill, hazard, 0.07, 0.3, 0.32 + pulse * 0.25, 0.03);
        } else {
          this.saw(r, o, v, hazardFill, hazard, p.hazard);
        }
      }
    }

    // ── Pass 3: interactive objects ──────────────────────────────────────
    stamp = ++this.stamp;
    for (let b = b0; b <= b1; b++) {
      const list = L.buckets[b];
      for (let i = 0; i < list.length; i++) {
        const o = L.objs[list[i]];
        if (o.kind < Kind.Pad || this.seen[o.id] === stamp) continue;
        this.seen[o.id] = stamp;
        switch (o.kind) {
          case Kind.Pad: this.pad(r, o, v); break;
          case Kind.Orb: this.orb(r, o, v); break;
          case Kind.Gate: this.gate(r, o, v); break;
          case Kind.Shard: this.shard(r, o, v); break;
        }
      }
    }

    // Finish line.
    if (v.right > L.endX - 4) {
      const x = L.endX + 1.5;
      r.shape(Shape.Fade, x - 1.5, 6, 12, 1.5, -Math.PI / 2, pack(p.accent, 0.22), 0, 0, 0, 0, 1.4);
      r.shape(Shape.Box, x, 6, 0.09, 14, 0, pack(WHITE), accent, 0, 2.6, 0.8 + pulse * 0.4);
      for (let i = 1; i <= 3; i++) {
        r.shape(Shape.Box, x + i * 0.55, 6, 0.03, 14, 0, pack(p.accent, 0.5 / i), accent, 0, 0.3, 0.3 / i);
      }
    }
  }

  private saw(r: Renderer, o: Obj, v: WorldView, fill: number, line: number, hz: RGB): void {
    sawCenter(o, v.beat, tmp);
    if (o.mx !== 0 || o.my !== 0) {
      const horizontal = Math.abs(o.mx) > Math.abs(o.my);
      r.shape(Shape.Box, o.x, o.y, horizontal ? Math.abs(o.mx) : 0.025, horizontal ? 0.025 : Math.abs(o.my), 0,
        pack(hz, 0.28), 0, 0, 0, 0, 0.02);
    }
    const rad = o.v;
    const dir = o.id % 2 === 0 ? 1 : -1;
    const teeth = Math.round(rad * 7) + 5;
    r.shape(Shape.Saw, tmp.x, tmp.y, rad, rad, v.time * 3.4 * dir, fill, line, 0.085, 0.5, 0.36 + v.pulse * 0.3, teeth);
    r.shape(Shape.Circle, tmp.x, tmp.y, rad * 0.26, rad * 0.26, 0, pack(hz, 0.9), line, 0, 0.2, 0.3);
  }

  private pad(r: Renderer, o: Obj, v: WorldView): void {
    const col = padColor(o.sub);
    const used = v.used[o.slot] !== 0;
    const ceiling = o.v === 1;
    const c = pack(col, used ? 0.35 : 1);
    const dirY = ceiling ? -1 : 1;
    if (!used) {
      const beam = 0.7 + v.pulse * 0.35;
      r.shape(Shape.Fade, o.x, o.y + dirY * (beam + 0.1), 0.36, beam, ceiling ? 0 : Math.PI, pack(col, 0.3), 0, 0, 0, 0, 1.3);
    }
    r.shape(Shape.Box, o.x, o.y, 0.42, 0.11, 0, c, c, 0, 0.5, used ? 0.1 : 0.55 + v.pulse * 0.3, 0.1);
  }

  private orb(r: Renderer, o: Obj, v: WorldView): void {
    const col = orbColor(o.sub);
    const used = v.used[o.slot] !== 0;
    const a = used ? 0.25 : 1;
    const s = used ? 0.7 : 1 + v.pulse * 0.12;
    r.shape(Shape.Circle, o.x, o.y, 0.62 * s, 0.62 * s, 0, 0, pack(col, 0.75 * a), 0.05, 0.3, 0.3 * a);
    r.shape(Shape.Circle, o.x, o.y, 0.34 * s, 0.34 * s, 0, pack(col, a), pack(WHITE, a), 0.07, 0.6, 0.6 * a);
    if (o.sub === Orb.Gravity && !used) {
      // Double chevron marks orbs that flip gravity.
      r.shape(Shape.Tri, o.x, o.y + 0.07, 0.12, 0.08, 0, pack(DARK), 0);
      r.shape(Shape.Tri, o.x, o.y - 0.09, 0.12, 0.08, Math.PI, pack(DARK), 0);
    }
  }

  private gate(r: Renderer, o: Obj, v: WorldView): void {
    const col = gateColor(o.sub, o.v);
    const line = pack(col);
    const breathe = 0.5 + v.pulse * 0.4;
    r.shape(Shape.Box, o.x, o.y, 0.6, 1.5, 0, pack(col, 0.07), line, 0.09, 0.9, breathe, 0.32);
    const ic = pack(col, 0.95);
    switch (o.sub) {
      case Gate.Cube:
        r.shape(Shape.Box, o.x, o.y, 0.2, 0.2, 0, ic, line, 0, 0.2, 0.4, 0.04);
        break;
      case Gate.Ship:
        r.shape(Shape.Tri, o.x, o.y, 0.17, 0.26, -Math.PI / 2, ic, line, 0, 0.2, 0.4, 0.02);
        break;
      case Gate.Wave:
        r.shape(Shape.Tri, o.x - 0.1, o.y + 0.1, 0.13, 0.13, -Math.PI / 4 - Math.PI / 2, ic, line, 0, 0.2, 0.4);
        r.shape(Shape.Tri, o.x + 0.1, o.y - 0.1, 0.13, 0.13, Math.PI / 4 - Math.PI / 2, ic, line, 0, 0.2, 0.4);
        break;
      case Gate.Flip:
        r.shape(Shape.Tri, o.x, o.y + 0.2, 0.2, 0.15, 0, ic, line, 0, 0.2, 0.4);
        r.shape(Shape.Tri, o.x, o.y - 0.15, 0.2, 0.15, 0, ic, line, 0, 0.2, 0.4);
        break;
      case Gate.Unflip:
        r.shape(Shape.Tri, o.x, o.y + 0.15, 0.2, 0.15, Math.PI, ic, line, 0, 0.2, 0.4);
        r.shape(Shape.Tri, o.x, o.y - 0.2, 0.2, 0.15, Math.PI, ic, line, 0, 0.2, 0.4);
        break;
      default: {
        const n = o.v >= 1.45 ? 3 : o.v >= 1.2 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const x = o.x + (i - (n - 1) / 2) * 0.26;
          r.shape(Shape.Tri, x, o.y, 0.2, 0.11, -Math.PI / 2, ic, line, 0, 0.2, 0.4);
        }
      }
    }
  }

  private shard(r: Renderer, o: Obj, v: WorldView): void {
    if (v.used[o.slot] !== 0) return;
    const bob = Math.sin(v.time * 2.4 + o.x) * 0.1;
    const s = 0.3 + v.pulse * 0.05;
    r.shape(Shape.Blob, o.x, o.y + bob, 1.3, 1.3, 0, pack(WHITE, 0.3), 0);
    r.shape(Shape.Box, o.x, o.y + bob, s, s, Math.PI / 4 + Math.sin(v.time * 1.7 + o.x) * 0.25,
      pack(WHITE, 0.95), pack(mix(WHITE, v.palette.accent2, 0.6, c1)), 0.08, 0.8, 0.9, 0.03);
  }
}
