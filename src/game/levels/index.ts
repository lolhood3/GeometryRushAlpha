import type { Level } from '../sim/level.ts';
import { buildApex } from './apex.ts';
import { buildGenesis } from './genesis.ts';
import { buildOverdrive } from './overdrive.ts';
import { buildQuantum } from './quantum.ts';
import { buildVelocity } from './velocity.ts';

const BUILDERS: Record<string, () => Level> = {
  genesis: buildGenesis,
  velocity: buildVelocity,
  overdrive: buildOverdrive,
  quantum: buildQuantum,
  apex: buildApex,
};

export const LEVEL_IDS = ['genesis', 'velocity', 'overdrive', 'quantum', 'apex'] as const;
/** The daily remix. It is a level like any other to play, but it is not one of the tracks: it has no stars, shards to bank or place in the unlock order. */
export const DAILY_ID = 'daily';
export type LevelId = (typeof LEVEL_IDS)[number];

const cache = new Map<string, Level>();
/** Levels that are put together at run time (the daily remix). They are asked for every time, never cached here. */
const PROVIDERS = new Map<string, () => Level>();

export function registerLevel(id: string, provide: () => Level): void {
  PROVIDERS.set(id, provide);
}

/** Levels are compiled on first use and shared (they are immutable at runtime). */
export function getLevel(id: string): Level {
  const provide = PROVIDERS.get(id);
  if (provide) return provide();
  let level = cache.get(id);
  if (!level) {
    const build = BUILDERS[id];
    if (!build) throw new Error(`Unknown level: ${id}`);
    level = build();
    cache.set(id, level);
  }
  return level;
}

export function allLevels(): Level[] {
  return LEVEL_IDS.map(getLevel);
}

export const TOTAL_SHARDS = LEVEL_IDS.length * 3;
