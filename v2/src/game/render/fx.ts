import type { RGB } from '../../engine/gfx/color.ts';
import { TAU } from '../../engine/math.ts';
import { PShape, type Particles } from '../../engine/particles.ts';

const rnd = Math.random;
const WHITE: RGB = [1, 1, 1];

/** Gameplay effect emitters. All positions in cells, velocities in cells/s. */
export class Fx {
  private readonly p: Particles;

  constructor(particles: Particles) {
    this.p = particles;
  }

  private n(count: number): number {
    return Math.max(1, Math.round(count * this.p.density));
  }

  ring(x: number, y: number, c: RGB, size = 0.5, grow = 3.2, life = 0.34): void {
    this.p.emit({ x, y, life, size, grow, r: c[0], g: c[1], b: c[2], shape: PShape.Ring });
  }

  burst(x: number, y: number, c: RGB, count: number, speed: number, shape: number = PShape.Square, life = 0.5): void {
    const n = this.n(count);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const v = speed * (0.35 + rnd() * 0.65);
      this.p.emit({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + rnd() * 0.6),
        size: 0.05 + rnd() * 0.09, grow: 0.2, r: c[0], g: c[1], b: c[2], shape,
        drag: 2.2, gravity: 6, rot: rnd() * TAU, spin: (rnd() - 0.5) * 14,
      });
    }
  }

  /** Dust kicked up at the contact surface. `dir` is +1 on the floor, -1 on a ceiling. */
  dust(x: number, y: number, dir: number, c: RGB, vx: number): void {
    if (rnd() > this.p.density) return;
    this.p.emit({
      x: x - 0.3 - rnd() * 0.2, y: y - dir * 0.46, vx: -vx * (0.15 + rnd() * 0.25), vy: dir * (0.4 + rnd() * 1.6),
      life: 0.28 + rnd() * 0.22, size: 0.035 + rnd() * 0.05, grow: 0.3, r: c[0], g: c[1], b: c[2],
      gravity: dir * 5, alpha: 0.85, rot: rnd() * TAU, spin: (rnd() - 0.5) * 10,
    });
  }

  jump(x: number, y: number, dir: number, c: RGB, synced: boolean): void {
    const n = this.n(synced ? 8 : 5);
    for (let i = 0; i < n; i++) {
      const side = (i / (n - 1 || 1)) * 2 - 1;
      this.p.emit({
        x: x + side * 0.3, y: y - dir * 0.46, vx: side * (1.5 + rnd() * 2) - 2, vy: dir * rnd() * 1.2,
        life: 0.3 + rnd() * 0.2, size: 0.05 + rnd() * 0.05, grow: 0.2, r: c[0], g: c[1], b: c[2], drag: 3,
      });
    }
    if (synced) this.ring(x, y, WHITE, 0.55, 2.6, 0.3);
  }

  land(x: number, y: number, dir: number, c: RGB, strength: number): void {
    const n = this.n(4 + strength * 6);
    for (let i = 0; i < n; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      this.p.emit({
        x: x + side * 0.35, y: y - dir * 0.47, vx: side * (1 + rnd() * 3) * (0.6 + strength), vy: dir * (0.3 + rnd() * 1.5),
        life: 0.25 + rnd() * 0.25, size: 0.04 + rnd() * 0.06, grow: 0.2, r: c[0], g: c[1], b: c[2], drag: 4, gravity: dir * 6,
      });
    }
  }

  thrust(x: number, y: number, c: RGB, vx: number, vy: number): void {
    if (rnd() > this.p.density) return;
    this.p.emit({
      x, y, vx: -vx * 0.5 + (rnd() - 0.5) * 1.5, vy: vy * 0.2 + (rnd() - 0.5) * 1.5,
      life: 0.22 + rnd() * 0.2, size: 0.08 + rnd() * 0.08, grow: 0.1, r: c[0], g: c[1], b: c[2],
      shape: PShape.Blob, alpha: 0.9,
    });
  }

  spark(x: number, y: number, c: RGB): void {
    this.p.emit({
      x, y, vx: -3 - rnd() * 4, vy: (rnd() - 0.5) * 3.5, life: 0.3 + rnd() * 0.3, size: 0.06 + rnd() * 0.05,
      r: c[0], g: c[1], b: c[2], shape: PShape.Spark, drag: 1.5, gravity: 4,
    });
  }

  pickup(x: number, y: number, c: RGB): void {
    this.ring(x, y, WHITE, 0.3, 5, 0.45);
    this.ring(x, y, c, 0.2, 7, 0.6);
    this.burst(x, y, WHITE, 14, 9, PShape.Spark, 0.55);
    this.burst(x, y, c, 8, 5, PShape.Tri, 0.7);
  }

  gate(x: number, y: number, c: RGB): void {
    this.ring(x, y, c, 0.8, 4, 0.5);
    const n = this.n(16);
    for (let i = 0; i < n; i++) {
      this.p.emit({
        x, y: y + (rnd() - 0.5) * 3, vx: 6 + rnd() * 10, vy: (rnd() - 0.5) * 2, life: 0.3 + rnd() * 0.3,
        size: 0.07 + rnd() * 0.06, r: c[0], g: c[1], b: c[2], shape: PShape.Spark, drag: 2.5,
      });
    }
  }

  death(x: number, y: number, a: RGB, b: RGB): void {
    this.ring(x, y, WHITE, 0.5, 9, 0.5);
    this.ring(x, y, a, 0.4, 6, 0.7);
    const n = this.n(34);
    for (let i = 0; i < n; i++) {
      const ang = rnd() * TAU;
      const v = 3 + rnd() * 13;
      const c = i % 3 === 0 ? b : i % 7 === 0 ? WHITE : a;
      this.p.emit({
        x: x + (rnd() - 0.5) * 0.5, y: y + (rnd() - 0.5) * 0.5, vx: Math.cos(ang) * v - 2, vy: Math.sin(ang) * v + 2,
        life: 0.5 + rnd() * 0.6, size: 0.07 + rnd() * 0.15, grow: 0.3, r: c[0], g: c[1], b: c[2],
        shape: i % 4 === 0 ? PShape.Tri : PShape.Square, drag: 2.4, gravity: 13, rot: rnd() * TAU, spin: (rnd() - 0.5) * 22,
      });
    }
    this.burst(x, y, WHITE, 10, 18, PShape.Spark, 0.35);
  }

  firework(x: number, y: number, c: RGB): void {
    this.ring(x, y, c, 0.4, 8, 0.7);
    const n = this.n(26);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + rnd() * 0.2;
      const v = 5 + rnd() * 6;
      this.p.emit({
        x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0.7 + rnd() * 0.5, size: 0.08 + rnd() * 0.06,
        r: c[0], g: c[1], b: c[2], shape: PShape.Spark, drag: 2.2, gravity: 5,
      });
    }
  }

  /** Slow drifting light motes that give the air some depth. */
  mote(x: number, y: number, c: RGB): void {
    this.p.emit({
      x, y, vx: -0.3 - rnd() * 0.9, vy: (rnd() - 0.5) * 0.4, life: 3 + rnd() * 3, size: 0.05 + rnd() * 0.1,
      r: c[0], g: c[1], b: c[2], shape: PShape.Blob, alpha: 0.35 + rnd() * 0.4,
    });
  }

  /** Streaks that sell the feeling of speed above 1x. */
  speedLine(x: number, y: number, c: RGB, speed: number): void {
    this.p.emit({
      x, y, vx: -14 * speed, vy: 0, life: 0.35, size: 0.16 + rnd() * 0.2, r: c[0], g: c[1], b: c[2],
      shape: PShape.Spark, alpha: 0.35,
    });
  }
}
