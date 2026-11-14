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
export type LevelId = (typeof LEVEL_IDS)[number];

const cache = new Map<string, Level>();

/** Levels are compiled on first use and shared (they are immutable at runtime). */
export function getLevel(id: string): Level {
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
