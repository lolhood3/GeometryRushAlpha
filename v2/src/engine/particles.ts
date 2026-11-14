import { Shape, type Renderer } from './gfx/renderer.ts';

export const PShape = { Square: 0, Blob: 1, Ring: 2, Spark: 3, Tri: 4 } as const;

export interface ParticleInit {
  x: number; y: number;
  vx?: number; vy?: number;
  life: number;
  size: number;
  /** Size multiplier reached at end of life (1 = constant). */
  grow?: number;
  r: number; g: number; b: number;
  alpha?: number;
  shape?: number;
  gravity?: number;
  drag?: number;
  rot?: number;
  spin?: number;
}

/**
 * Fixed-capacity particle pool stored as flat typed arrays. Spawning never
 * allocates; when the pool is full the oldest particle is recycled.
 */
export class Particles {
  readonly capacity: number;
  /** 0..1 – scales how many particles `burst` style helpers should emit. */
  density = 1;
  count = 0;
  private cursor = 0;
  private readonly x: Float32Array; private readonly y: Float32Array;
  private readonly vx: Float32Array; private readonly vy: Float32Array;
  private readonly life: Float32Array; private readonly max: Float32Array;
  private readonly size: Float32Array; private readonly grow: Float32Array;
  private readonly rot: Float32Array; private readonly spin: Float32Array;
  private readonly grav: Float32Array; private readonly drag: Float32Array;
  private readonly alpha: Float32Array;
  private readonly rgb: Uint32Array;
  private readonly shape: Uint8Array;

  constructor(capacity = 1536) {
    this.capacity = capacity;
    const f = () => new Float32Array(capacity);
    this.x = f(); this.y = f(); this.vx = f(); this.vy = f(); this.life = f(); this.max = f();
    this.size = f(); this.grow = f(); this.rot = f(); this.spin = f(); this.grav = f(); this.drag = f();
    this.alpha = f();
    this.rgb = new Uint32Array(capacity);
    this.shape = new Uint8Array(capacity);
  }

  clear(): void {
    this.life.fill(0);
    this.count = 0;
  }

  emit(p: ParticleInit): void {
    // Find a free slot starting at the cursor; fall back to overwriting.
    let i = this.cursor;
    for (let n = 0; n < 8; n++) {
      if (this.life[i] <= 0) break;
      i = (i + 1) % this.capacity;
    }
    this.cursor = (i + 1) % this.capacity;
    this.x[i] = p.x; this.y[i] = p.y;
    this.vx[i] = p.vx ?? 0; this.vy[i] = p.vy ?? 0;
    this.life[i] = this.max[i] = p.life;
    this.size[i] = p.size; this.grow[i] = p.grow ?? 1;
    this.rot[i] = p.rot ?? 0; this.spin[i] = p.spin ?? 0;
    this.grav[i] = p.gravity ?? 0; this.drag[i] = p.drag ?? 0;
    this.alpha[i] = p.alpha ?? 1;
    const c = (v: number) => (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0);
    this.rgb[i] = (c(p.b) << 16) | (c(p.g) << 8) | c(p.r);
    this.shape[i] = p.shape ?? PShape.Square;
  }

  update(dt: number): void {
    const { life, x, y, vx, vy, grav, drag, rot, spin } = this;
    let alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) continue;
      alive++;
      vy[i] -= grav[i] * dt;
      if (drag[i] > 0) {
        const k = Math.exp(-drag[i] * dt);
        vx[i] *= k; vy[i] *= k;
      }
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      rot[i] += spin[i] * dt;
    }
    this.count = alive;
  }

  draw(r: Renderer, minX: number, maxX: number): void {
    const { life, max, x, y, size, grow, rot, alpha, rgb, shape, vx, vy } = this;
    for (let i = 0; i < this.capacity; i++) {
      if (life[i] <= 0) continue;
      const px = x[i];
      if (px < minX || px > maxX) continue;
      const t = 1 - life[i] / max[i];
      const s = size[i] * (1 + (grow[i] - 1) * t);
      const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const a = alpha[i] * fade;
      const col = (rgb[i] | (((a >= 1 ? 255 : (a * 255) | 0)) << 24)) >>> 0;
      switch (shape[i]) {
        case PShape.Blob:
          r.shape(Shape.Blob, px, y[i], s, s, 0, col, 0);
          break;
        case PShape.Ring:
          r.shape(Shape.Circle, px, y[i], s, s, 0, 0, col, Math.max(0.03, s * 0.12 * (1 - t)), 0.25, 0.5 * a);
          break;
        case PShape.Spark: {
          const ang = Math.atan2(vy[i], vx[i]);
          r.shape(Shape.Box, px, y[i], s * 2.2, s * 0.28, ang, col, col, 0, 0.18, 0.5 * a, s * 0.28);
          break;
        }
        case PShape.Tri:
          r.shape(Shape.Tri, px, y[i], s, s, rot[i], col, col, 0, 0.12, 0.35 * a);
          break;
        default:
          r.shape(Shape.Box, px, y[i], s, s, rot[i], col, col, 0, 0.14, 0.4 * a, s * 0.2);
      }
    }
  }
}
