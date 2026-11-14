import { damp } from '../../engine/math.ts';

/**
 * Side-scrolling camera in world cells. Keeps the player at a fixed screen
 * column, shows the ground line low in the frame and rises only when the
 * action leaves the lower part of the screen.
 */
export class Camera {
  x = 0;
  y = 0;
  /** Device pixels per cell. */
  scale = 40;
  zoom = 1;
  zoomTarget = 1;
  viewW = 20;
  viewH = 11;
  /** Fraction of the screen width where the player sits. */
  anchor = 0.3;
  private rise = 0;
  private shakeAmp = 0;
  private shakeT = 0;
  shakeX = 0;
  shakeY = 0;
  /** Menu backdrop: push the action to the right, clear of the menu column. */
  backdrop = false;
  private portrait = false;
  private width = 1;
  private height = 1;

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.portrait = height > width;
    this.apply();
  }

  private apply(): void {
    this.scale = Math.min(this.height / 11.5, this.width / 15) * this.zoom;
    this.viewW = this.width / this.scale;
    this.viewH = this.height / this.scale;
  }

  /** World height of the ground line above the bottom edge of the view. */
  private groundMargin(): number {
    return Math.min(this.viewH * 0.3, Math.max(2.6, this.viewH * 0.24));
  }

  follow(px: number, py: number, dt: number, snap = false): void {
    this.zoom = snap ? this.zoomTarget : damp(this.zoom, this.zoomTarget, 3, dt);
    this.apply();
    const base = this.viewH / 2 - this.groundMargin();
    const over = Math.max(0, py - (base + this.viewH * 0.12)) * 0.72;
    this.rise = snap ? over : damp(this.rise, over, 4.5, dt);
    const anchor = this.portrait ? 0.22 : this.backdrop ? 0.58 : 0.3;
    this.anchor = snap ? anchor : damp(this.anchor, anchor, 3, dt);
    this.x = px + (0.5 - this.anchor) * this.viewW;
    this.y = base + this.rise;

    if (this.shakeAmp > 0.001) {
      this.shakeT += dt * 62;
      this.shakeX = Math.sin(this.shakeT * 1.31) * this.shakeAmp;
      this.shakeY = Math.cos(this.shakeT * 1.77) * this.shakeAmp;
      this.shakeAmp *= Math.exp(-dt * 9);
    } else {
      this.shakeAmp = this.shakeX = this.shakeY = 0;
    }
  }

  shake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  get left(): number { return this.x - this.viewW / 2; }
  get right(): number { return this.x + this.viewW / 2; }
  /** Ground line (y = 0) in device pixels from the bottom of the screen. */
  get horizonPx(): number { return (0 - (this.y + this.shakeY)) * this.scale + this.height / 2; }
}
