/**
 * requestAnimationFrame driver with frame-time statistics. Simulation stepping
 * is not done here: the game derives its tick count from the audio clock, so
 * the loop only has to deliver frames and measure them.
 */
export class FrameLoop {
  /** Smoothed frames per second. */
  fps = 60;
  /** Smoothed frame time in milliseconds. */
  frameMs = 16.7;
  private raf = 0;
  private last = 0;
  private running = false;
  private readonly cb: (dt: number, now: number) => void;

  constructor(cb: (dt: number, now: number) => void) {
    this.cb = cb;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const raw = this.last === 0 ? 16.7 : now - this.last;
    this.last = now;
    if (raw < 250) {
      this.frameMs += (raw - this.frameMs) * 0.06;
      this.fps = 1000 / this.frameMs;
    }
    this.cb(Math.min(raw, 250) / 1000, now / 1000);
  };
}
