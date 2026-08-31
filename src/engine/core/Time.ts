/**
 * Manages Rush Engine timing, delta time calculation, frame counting, and FPS tracking.
 */
export class Time {
  /**
   * Delta time for the current variable frame in seconds, multiplied by timeScale.
   */
  public deltaTime: number = 0;

  /**
   * Unscaled delta time for the current frame in seconds (ignores timeScale).
   */
  public unscaledDeltaTime: number = 0;

  /**
   * Fixed time step duration for deterministic physics/game logic simulation (seconds).
   * Default: 1/60s (~0.016667s).
   */
  public fixedDeltaTime: number = 1 / 60;

  /**
   * Global time scale multiplier (1.0 = normal speed, 0.5 = slow motion, 0 = paused).
   */
  public timeScale: number = 1.0;

  /**
   * Total elapsed engine run time in seconds (scaled by timeScale).
   */
  public elapsedTime: number = 0;

  /**
   * Total unscaled elapsed engine run time in seconds.
   */
  public unscaledElapsedTime: number = 0;

  /**
   * Total number of rendered frames since engine start.
   */
  public frameCount: number = 0;

  /**
   * Current instantaneous Frames Per Second.
   */
  public fps: number = 60;

  /**
   * Smoothed rolling average Frames Per Second for stable display.
   */
  public fpsSmoothed: number = 60;

  private readonly maxSamples: number = 30;
  private readonly fpsSamples: Float64Array = new Float64Array(30);
  private sampleIndex: number = 0;
  private sampleCount: number = 0;
  private sampleSum: number = 0;

  constructor(fixedDeltaTime: number = 1 / 60) {
    this.fixedDeltaTime = fixedDeltaTime;
  }

  /**
   * Advances timing metrics by a raw frame delta time in seconds.
   * Zero allocations per tick.
   * @param rawDeltaTime Delta time in seconds provided by the game loop.
   */
  public update(rawDeltaTime: number): void {
    this.unscaledDeltaTime = rawDeltaTime;
    this.deltaTime = rawDeltaTime * this.timeScale;

    this.unscaledElapsedTime += this.unscaledDeltaTime;
    this.elapsedTime += this.deltaTime;
    this.frameCount++;

    // Calculate instantaneous FPS
    if (rawDeltaTime > 0) {
      this.fps = 1 / rawDeltaTime;
    }

    // Zero-allocation circular buffer rolling average
    if (this.sampleCount < this.maxSamples) {
      this.fpsSamples[this.sampleIndex] = this.fps;
      this.sampleSum += this.fps;
      this.sampleCount++;
    } else {
      this.sampleSum -= this.fpsSamples[this.sampleIndex];
      this.fpsSamples[this.sampleIndex] = this.fps;
      this.sampleSum += this.fps;
    }

    this.sampleIndex = (this.sampleIndex + 1) % this.maxSamples;
    this.fpsSmoothed = this.sampleCount > 0 ? Math.round(this.sampleSum / this.sampleCount) : 60;
  }

  /**
   * Resets all timing counters to initial values.
   */
  public reset(): void {
    this.deltaTime = 0;
    this.unscaledDeltaTime = 0;
    this.elapsedTime = 0;
    this.unscaledElapsedTime = 0;
    this.frameCount = 0;
    this.fps = 60;
    this.fpsSmoothed = 60;
    this.fpsSamples.fill(0);
    this.sampleIndex = 0;
    this.sampleCount = 0;
    this.sampleSum = 0;
  }
}
