/**
 * Keeping the frame rate by spending less, and spending again when there is room.
 *
 * A `Governor` owns one dial with a few positions, 0 being full quality. It is
 * told the recent frame time and moves the dial:
 *
 *  - down a position when frames have run long for a moment;
 *  - back up when they have been comfortable for a while. Going up is a trial:
 *    if frames run long again straight after, it comes back down and waits
 *    twice as long before the next try, so it settles instead of flapping;
 *  - all the way back to full if the lowest position bought nothing. Frames
 *    that stay long whatever is cut are not long because of this dial: the
 *    display is capped (30 fps in a phone's low-power mode, for one) or the
 *    time is going somewhere else. It then takes that frame time as normal
 *    for this device ("resigned") and only acts if frames get longer still,
 *    until they come back within the real budget.
 *
 * The game runs two of these: a quick one for particles and effects, and a
 * slow one for render resolution (see game.ts).
 */
export interface GovernorOptions {
  /** How many positions the dial has, full quality included. */
  steps: number;
  /** Frame time aimed for, ms. */
  budgetMs?: number;
  /** Frames longer than `budgetMs × over` are running long. */
  over?: number;
  /** Frames shorter than `budgetMs × under` leave room to try more. */
  under?: number;
  /** Seconds frames must run long before a cut. */
  slowFor: number;
  /** Seconds to let a change show in the measurement before judging again. */
  settle: number;
  /** Seconds of comfortable frames before trying a position up; doubles after a failed try. */
  patience: number;
  maxPatience: number;
  /** Seconds to leave the dial alone after finding that cuts do not help, while the measurement catches up. */
  rest?: number;
}

/** The lowest position must shorten frames by at least this share to count as helping. */
const WORTH_IT = 0.1;

export class Governor {
  /** Current position: 0 is full quality, `steps - 1` the least. */
  step = 0;
  private readonly o: Required<GovernorOptions>;
  private since = 0;
  private slow = 0;
  private calm = 0;
  private patience: number;
  private resting = 0;
  /** The frame time judged against: the budget, or longer once cutting was found not to help. */
  private target: number;
  private trial = false;
  /** Frame time when the first cut was made: what the lowest position is compared with. */
  private fullMs = 0;

  constructor(options: GovernorOptions) {
    this.o = { budgetMs: 1000 / 60, over: 1.1, under: 1.04, rest: 3, ...options };
    this.patience = this.o.patience;
    this.target = this.o.budgetMs;
  }

  /** True once cutting was found not to help and long frames are being accepted as this device's normal. */
  get resigned(): boolean { return this.target > this.o.budgetMs; }
  /** True at the lowest position. */
  get floored(): boolean { return this.step >= this.o.steps - 1; }

  /** Back to full quality with nothing remembered. */
  reset(): void {
    this.step = 0;
    this.since = this.slow = this.calm = this.resting = 0;
    this.patience = this.o.patience;
    this.target = this.o.budgetMs;
    this.trial = false;
  }

  /**
   * Feeds the recent frame time (smoothed, ms) and the time since the last call (s).
   * Returns true when the position changed.
   */
  update(frameMs: number, dt: number): boolean {
    const o = this.o;
    if (!(frameMs > 0) || !(dt > 0)) return false;
    if (this.resting > 0) {
      this.resting -= dt;
      return false;
    }
    this.since += dt;
    // Frames are back within the real budget: whatever held them up is gone.
    if (this.resigned && frameMs <= o.budgetMs * o.over) this.target = o.budgetMs;

    if (frameMs > this.target * o.over) {
      this.calm = 0;
      this.slow += dt;
      if (this.since < o.settle || this.slow < o.slowFor) return false;
      if (this.trial) {
        // The step up that was just tried did not hold.
        this.trial = false;
        this.patience = Math.min(o.maxPatience, this.patience * 2);
      }
      if (!this.floored) {
        if (this.step === 0) this.fullMs = frameMs;
        this.step++;
        this.since = this.slow = 0;
        return true;
      }
      if (frameMs > this.fullMs * (1 - WORTH_IT)) {
        // Everything is cut and frames are as long as before: this dial is not the reason.
        this.step = 0;
        this.since = this.slow = 0;
        this.resting = o.rest;
        this.target = Math.max(this.target, frameMs);
        this.patience = o.patience;
        return true;
      }
      return false;
    }

    this.slow = 0;
    // Neither long nor comfortable: hold, and keep what calm there has been (one dropped frame is not a verdict).
    if (frameMs >= this.target * o.under) return false;
    this.calm += dt;
    if (this.calm < this.patience || this.since < o.settle) return false;
    this.calm = 0;
    if (this.trial) {
      // The last step up has held for a full wait: trust it, and be quicker next time.
      this.trial = false;
      this.patience = Math.max(o.patience, this.patience / 2);
    }
    if (this.step === 0) return false;
    this.step--;
    this.since = 0;
    this.trial = true;
    return true;
  }
}

/** A frame longer than this (20 fps) is counted as this long, in seconds. */
const LONGEST_COUNTED = 0.05;

/** Share of the full particle and effect load at each position of the effects dial. */
export const EFFECT_SHARES = [1, 0.75, 0.55, 0.4, 0.25] as const;

/**
 * Frame time followed over about `seconds`. The long gap a hidden or stalled
 * tab leaves is ignored, and a single hitch counts for no more than a slow
 * frame would: one garbage collection is not a reason to change anything.
 */
export class FrameAverage {
  ms = 1000 / 60;
  private readonly seconds: number;

  constructor(seconds = 0.4) {
    this.seconds = seconds;
  }

  /** `dt` is the time since the previous frame in seconds. Returns false for a gap that was not counted. */
  push(dt: number): boolean {
    if (!(dt > 0) || dt >= 0.2) return false;
    const d = Math.min(dt, LONGEST_COUNTED);
    this.ms += (d * 1000 - this.ms) * (1 - Math.exp(-d / this.seconds));
    return true;
  }
}

/** Frames longer than this are what the resolution step-down reacts to (about 48 fps). */
export const SLOW_FRAME_MS = 21;

/**
 * The two dials together, as the game uses them.
 *
 * Effects are thinned first, whatever the quality setting, and come back when
 * frames are comfortable again. Render resolution follows only when asked to
 * (`auto`), and only once effects are at their least or were found not to
 * matter, so the two are never both hunting for the same lost milliseconds.
 */
export class RenderBudget {
  readonly pace = new FrameAverage();
  /** Quick to cut, quick to give back. */
  readonly effects = new Governor({
    steps: EFFECT_SHARES.length, slowFor: 0.5, settle: 1.2, patience: 4, maxPatience: 60,
  });
  /** A change of resolution is visible, so this one moves slowly. */
  readonly resolution: Governor;

  constructor(scales: number) {
    this.resolution = new Governor({
      steps: scales, over: SLOW_FRAME_MS / (1000 / 60), slowFor: 2, settle: 3, patience: 20, maxPatience: 240,
    });
  }

  /** Share of the full particle and effect load currently affordable. */
  get share(): number { return EFFECT_SHARES[this.effects.step]; }

  /**
   * Call once a frame with the time since the last one (s). Returns which
   * dials moved: bit 1 for effects, bit 2 for resolution.
   */
  update(dt: number, auto: boolean): number {
    if (!this.pace.push(dt)) return 0;
    const ms = this.pace.ms;
    let moved = this.effects.update(ms, dt) ? 1 : 0;
    if (!auto) return moved;
    // Going down waits for effects; coming back up waits for nothing.
    const spent = this.effects.floored || this.effects.resigned;
    if (ms > SLOW_FRAME_MS && !spent) return moved;
    if (this.resolution.update(ms, dt)) moved |= 2;
    return moved;
  }
}
