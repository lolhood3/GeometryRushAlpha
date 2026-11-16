import { getLevel } from './levels/index.ts';
import type { Profile } from './progression/profile.ts';
import { xAtBeat } from './sim/level.ts';

/**
 * The guided intro: four short lessons laid over the opening of Genesis the
 * first time it is played. The level itself is untouched; each lesson is shown
 * while the player crosses the stretch that teaches it, and is ticked off when
 * the player actually does the thing.
 */
export const INTRO_LEVEL = 'genesis';
/** Stored in `profile.seen` once the intro has been finished or skipped. */
export const INTRO_DONE = 'intro:done';
/** Stored in `profile.seen` when the player asks to see the intro again. */
export const INTRO_AGAIN = 'intro:again';

export type IntroStepId = 'jump' | 'beat' | 'shards' | 'hold';

export interface IntroStep {
  id: IntroStepId;
  /** Shown from this beat (the first one also covers the count-in) until the next step begins. */
  from: number;
}

/**
 * Matched to what Genesis asks for: single spikes up to beat 8, spaced spikes
 * to jump in time with until 20, a calm run of blocks and stairs until 33, then
 * three spikes a beat apart and a row of pits that are cleared by holding.
 */
export const INTRO_STEPS: readonly IntroStep[] = [
  { id: 'jump', from: -Infinity },
  { id: 'beat', from: 8 },
  { id: 'shards', from: 20 },
  { id: 'hold', from: 33 },
];
/** The intro is over once the player is past this beat. About 23 seconds in. */
export const INTRO_END_BEAT = 47.5;

/** Best percentage a player has when they have got through the stretch the intro covers. */
export function introEndPercent(): number {
  const level = getLevel(INTRO_LEVEL);
  return Math.floor((xAtBeat(level, INTRO_END_BEAT) / level.endX) * 100);
}

/**
 * Whether the intro should run. It is for players who have not yet got through
 * the opening of Genesis, so a save from before the intro existed is left alone
 * unless the player asks for it.
 */
export function introWanted(p: Profile): boolean {
  if (p.seen.includes(INTRO_AGAIN)) return true;
  if (p.seen.includes(INTRO_DONE)) return false;
  const rec = p.levels[INTRO_LEVEL];
  const past = introEndPercent();
  return !rec.completed && !rec.practiceCompleted && rec.best < past && rec.practiceBest < past;
}

export interface IntroView {
  /** Index into INTRO_STEPS. */
  step: number;
  /** The player has done what this step asks. */
  done: boolean;
}

/** Follows one visit to the level. Nothing here is saved; only finishing or skipping is. */
export class IntroTracker {
  private readonly done = INTRO_STEPS.map(() => false);
  private lastJumpPress = -1;

  stepAt(beat: number): number {
    let i = INTRO_STEPS.length - 1;
    while (i > 0 && INTRO_STEPS[i].from > beat) i--;
    return i;
  }

  /**
   * A jump left the ground. `press` numbers the button presses of the attempt,
   * so two jumps on the same number are one held press.
   */
  jumped(press: number, streak: number): void {
    this.done[0] = true;
    if (streak >= 2) this.done[1] = true;
    if (press === this.lastJumpPress) this.done[3] = true;
    this.lastJumpPress = press;
  }

  /** A new attempt begins: presses are numbered from scratch. */
  attempt(): void {
    this.lastJumpPress = -1;
  }

  view(beat: number): IntroView {
    const step = this.stepAt(beat);
    // The shards step only informs; it counts as taken in once the player has moved on.
    if (step > 2) this.done[2] = true;
    return { step, done: this.done[step] };
  }

  finished(beat: number): boolean {
    return beat >= INTRO_END_BEAT;
  }
}
