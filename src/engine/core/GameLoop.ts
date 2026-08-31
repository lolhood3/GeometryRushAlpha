import { Time } from './Time.ts';

export interface GameLoopCallbacks {
  /**
   * Called at a constant, fixed frequency for deterministic logic and physics.
   * @param fixedDelta The fixed timestep in seconds.
   */
  onFixedUpdate: (fixedDelta: number) => void;

  /**
   * Called once per animation frame before rendering for variable-rate updates.
   * @param delta The frame delta time in seconds.
   */
  onUpdate: (delta: number) => void;

  /**
   * Called once per frame to render graphics to the screen.
   * @param alpha The interpolation factor between previous and current fixed state [0, 1].
   */
  onRender: (alpha: number) => void;
}

export interface GameLoopOptions {
  /**
   * Fixed simulation timestep in seconds (default: 1/60s = 0.016667s).
   */
  fixedDeltaTime?: number;

  /**
   * Maximum accumulated time allowed in one frame to prevent the "spiral of death" (default: 0.25s).
   */
  maxAccumulator?: number;
}

/**
 * Production-ready game loop implementing fixed-timestep simulation with variable rendering for Rush Engine.
 * Uses requestAnimationFrame, high-resolution performance.now() timestamps,
 * and an accumulator pattern for deterministic physics/logic updates.
 */
export class GameLoop {
  private readonly callbacks: GameLoopCallbacks;
  private readonly time: Time;

  private isRunning: boolean = false;
  private isPaused: boolean = false;

  private animationFrameId: number | null = null;
  private previousTime: number = 0;
  private accumulator: number = 0;

  private readonly maxAccumulator: number;

  constructor(callbacks: GameLoopCallbacks, time: Time, options: GameLoopOptions = {}) {
    this.callbacks = callbacks;
    this.time = time;
    this.maxAccumulator = options.maxAccumulator ?? 0.25;

    if (options.fixedDeltaTime) {
      this.time.fixedDeltaTime = options.fixedDeltaTime;
    }
  }

  /**
   * Starts the game loop.
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.previousTime = performance.now();
    this.accumulator = 0;

    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  /**
   * Stops the game loop and cancels scheduled animation frames.
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.accumulator = 0;
  }

  /**
   * Pauses simulation updates while keeping the loop alive or halted.
   */
  public pause(): void {
    this.isPaused = true;
  }

  /**
   * Resumes simulation updates.
   */
  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.previousTime = performance.now();
  }

  /**
   * Returns whether the game loop is currently running.
   */
  public get running(): boolean {
    return this.isRunning;
  }

  /**
   * Returns whether the game loop is paused.
   */
  public get paused(): boolean {
    return this.isPaused;
  }

  /**
   * Main frame tick callback invoked by requestAnimationFrame.
   */
  private tick = (currentTime: number): void => {
    if (!this.isRunning) return;

    // Schedule next frame immediately
    this.animationFrameId = requestAnimationFrame(this.tick);

    // Calculate raw delta time in seconds
    let frameTime = (currentTime - this.previousTime) / 1000;
    this.previousTime = currentTime;

    // Guard against negative delta on clock jitter and clamp frame time to avoid spiral of death
    if (frameTime < 0) {
      frameTime = 0;
    } else if (frameTime > this.maxAccumulator) {
      frameTime = this.maxAccumulator;
    }

    // Update timing metrics
    this.time.update(frameTime);

    if (!this.isPaused) {
      // Accumulate scaled delta time for fixed physics/logic updates
      this.accumulator += this.time.deltaTime;

      const fixedStep = this.time.fixedDeltaTime;

      // Consume accumulator in discrete fixed-step chunks
      while (this.accumulator >= fixedStep) {
        this.callbacks.onFixedUpdate(fixedStep);
        this.accumulator -= fixedStep;
      }

      // Variable frame update (for inputs, animations, cameras)
      this.callbacks.onUpdate(this.time.deltaTime);
    }

    // Calculate alpha interpolation factor: fraction of the remaining accumulator
    const alpha = this.time.fixedDeltaTime > 0 ? this.accumulator / this.time.fixedDeltaTime : 1.0;

    // Render frame with interpolation factor
    this.callbacks.onRender(alpha);
  };
}
