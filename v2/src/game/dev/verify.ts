import type { SolveOptions } from './solver.ts';

/**
 * Human-tolerance budget each level must be beatable within (all three shards
 * included). `jitter` is the timing error, in beats, applied to every input.
 */
export const VERIFY: Record<string, Partial<SolveOptions>> = {
  genesis: { jitter: 0.1 },
  velocity: { jitter: 0.06 },
  overdrive: { jitter: 0.06 },
  quantum: { jitter: 0.05 },
  apex: { jitter: 0.04 },
};
