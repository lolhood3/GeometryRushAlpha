import { hex, mix, pack, type RGB } from '../../engine/gfx/color.ts';
import { Shape, type Renderer } from '../../engine/gfx/renderer.ts';
import { Mode } from '../sim/constants.ts';
import { findChassis, findPaint, findTrail, type Chassis, type Trail } from '../progression/cosmetics.ts';
import type { Loadout } from '../progression/profile.ts';

const DARK: RGB = [0.03, 0.04, 0.08];
const WHITE: RGB = [1, 1, 1];
const t0: RGB = [0, 0, 0];

/** Resolved, render-ready version of the player's loadout. */
export interface Look {
  chassis: Chassis;
  trail: Trail;
  primary: RGB;
  secondary: RGB;
}

export function resolveLook(l: Loadout): Look {
  return {
    chassis: findChassis(l.chassis),
    trail: findTrail(l.trail),
    primary: hex(findPaint(l.primary).hex),
    secondary: hex(findPaint(l.secondary).hex),
  };
}

export interface PlayerPose {
  x: number;
  y: number;
  rot: number;
  mode: number;
  grav: number;
  /** Squash (<1) / stretch (>1) along the vertical axis. */
  stretch: number;
  alpha: number;
  /** 0..1 thruster intensity for the ship. */
  thrust: number;
}

/** Draws the chassis icon: a body plus its decorative layers, in a unit square. */
function drawCube(r: Renderer, look: Look, x: number, y: number, rot: number, size: number, sy: number, alpha: number, glow: number): void {
  const ch = look.chassis;
  const hw = 0.5 * size * (1 + (1 - sy) * 0.5);
  const hh = 0.5 * size * sy;
  const line = pack(mix(look.primary, WHITE, 0.6, t0), alpha);
  if (ch.hollow) {
    r.shape(Shape.Box, x, y, hw, hh, rot, pack(look.primary, 0.1 * alpha), pack(look.primary, alpha), 0.1 * size, 0.6 * size, glow, 0.1 * size);
  } else {
    r.shape(Shape.Box, x, y, hw, hh, rot, pack(look.primary, alpha), line, 0.065 * size, 0.6 * size, glow, 0.1 * size);
  }
  const c = Math.cos(rot), s = Math.sin(rot);
  for (const part of ch.parts) {
    const lx = part.x * size, ly = part.y * size * sy;
    const wx = x + lx * c - ly * s;
    const wy = y + lx * s + ly * c;
    const col = part.color === 'p' ? look.primary : part.color === 's' ? look.secondary : part.color === 'k' ? DARK : WHITE;
    const fill = pack(col, alpha);
    const pw = (part.w / 2) * size, ph = (part.h / 2) * size * sy;
    switch (part.shape) {
      case 'circle':
        r.shape(Shape.Circle, wx, wy, pw, pw, 0, fill, 0);
        break;
      case 'tri':
        r.shape(Shape.Tri, wx, wy, pw - 0.02 * size, ph - 0.02 * size, rot + (part.rot ?? 0), fill, 0, 0, 0, 0, 0.02 * size);
        break;
      case 'diamond':
        r.shape(Shape.Box, wx, wy, pw * 0.7071, ph * 0.7071, rot + Math.PI / 4, fill, 0, 0, 0, 0, 0.02 * size);
        break;
      default:
        r.shape(Shape.Box, wx, wy, pw, ph, rot + (part.rot ?? 0), fill, 0, 0, 0, 0, (part.radius ?? 0) * size);
    }
  }
}

export function drawPlayer(r: Renderer, look: Look, p: PlayerPose, pulse: number): void {
  const a = p.alpha;
  if (a <= 0.01) return;
  const glow = (0.45 + pulse * 0.3) * a;
  r.shape(Shape.Blob, p.x, p.y, 1.9, 1.9, 0, pack(look.primary, 0.2 * a), 0);

  if (p.mode === Mode.Cube) {
    drawCube(r, look, p.x, p.y, p.rot, 1, p.stretch, a, glow);
    return;
  }
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  const line = pack(mix(look.primary, WHITE, 0.6, t0), a);
  if (p.mode === Mode.Ship) {
    const g = p.grav;
    // Exhaust.
    if (p.thrust > 0.02) {
      const ex = p.x - 0.72 * c, ey = p.y - 0.72 * s;
      r.shape(Shape.Blob, ex, ey, 0.5 + p.thrust * 0.35, 0.28, p.rot, pack(look.secondary, 0.85 * p.thrust * a), 0);
    }
    // Hull: a wedge under the rider.
    const hx = p.x + 0.12 * g * s, hy = p.y - 0.12 * g * c;
    r.shape(Shape.Tri, hx, hy, 0.3, 0.6, p.rot - Math.PI / 2, pack(look.primary, a), line, 0.06, 0.5, glow, 0.04);
    r.shape(Shape.Box, hx - 0.3 * c, hy - 0.3 * s, 0.08, 0.3, p.rot, pack(look.secondary, a), 0, 0, 0, 0, 0.03);
    // Rider: the chassis, miniaturised.
    const rx = p.x - 0.08 * c - 0.17 * g * s, ry = p.y - 0.08 * s + 0.17 * g * c;
    drawCube(r, look, rx, ry, p.rot, 0.46, 1, a, glow * 0.5);
  } else {
    r.shape(Shape.Tri, p.x, p.y, 0.3, 0.44, p.rot - Math.PI / 2, pack(look.primary, a), line, 0.06, 0.5, glow, 0.04);
    r.shape(Shape.Tri, p.x - 0.12 * c, p.y - 0.12 * s, 0.13, 0.19, p.rot - Math.PI / 2, pack(look.secondary, a), 0);
  }
}

const MAX_POINTS = 96;
const SPACING = 0.22;

/** Position history rendered as a tapered additive ribbon. */
export class TrailRibbon {
  private readonly xs = new Float32Array(MAX_POINTS);
  private readonly ys = new Float32Array(MAX_POINTS);
  private readonly pts = new Float32Array((MAX_POINTS + 1) * 4);
  private head = 0;
  private n = 0;
  private lastX = 0;
  private liveX = 0;
  private liveY = 0;

  reset(): void {
    this.n = 0;
    this.head = 0;
  }

  /**
   * Records the newest position. Samples are committed at a fixed spacing so
   * the ribbon looks the same at any frame rate; the newest point always
   * tracks the player exactly.
   */
  push(x: number, y: number): void {
    if (this.n > 0 && (x < this.lastX - 0.5 || x > this.lastX + 6)) this.reset();
    this.liveX = x;
    this.liveY = y;
    if (this.n > 0 && x - this.lastX < SPACING) return;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.lastX = x;
    this.head = (this.head + 1) % MAX_POINTS;
    if (this.n < MAX_POINTS) this.n++;
  }

  draw(r: Renderer, look: Look, mode: number, pulse: number, alpha: number): void {
    const tr = look.trail;
    if (tr.length === 0 || alpha <= 0.01 || this.n === 0) return;
    const boost = mode === Mode.Wave ? 1.5 : mode === Mode.Ship ? 1.15 : 1;
    const stored = Math.min(this.n, Math.round(tr.length * boost));
    const live = this.liveX > this.lastX + 0.01 ? 1 : 0;
    const count = stored + live;
    if (count < 2) return;
    const width = tr.width * (mode === Mode.Wave ? 1.25 : 1) * (tr.pulse ? 0.65 + pulse * 0.9 : 1);
    const pts = this.pts;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      if (i < stored) {
        const src = (this.head + MAX_POINTS - stored + i) % MAX_POINTS;
        pts[i * 4] = this.xs[src];
        pts[i * 4 + 1] = this.ys[src];
      } else {
        pts[i * 4] = this.liveX;
        pts[i * 4 + 1] = this.liveY;
      }
      pts[i * 4 + 2] = width * (0.25 + 0.75 * t);
      pts[i * 4 + 3] = t * t;
    }
    if (tr.dual) {
      r.ribbon(pts, count, look.secondary, 0.8 * alpha, 0);
      const half = count >> 1;
      r.ribbon(pts.subarray(half * 4), count - half, look.primary, 0.9 * alpha, 0.5);
    } else {
      r.ribbon(pts, count, look.primary, 0.85 * alpha, 0.5);
    }
  }
}
