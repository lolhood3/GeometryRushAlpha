/**
 * Simulation constants. All motion is expressed in *beat time*:
 * distances in cells, time in beats. One beat is always CELLS_PER_BEAT cells of
 * travel at 1x speed and a cube jump always lasts exactly one beat, so the
 * whole game stays locked to the music regardless of tempo.
 */
export const TICK_RATE = 240;
export const DT = 1 / TICK_RATE;

export const CELLS_PER_BEAT = 4;

export const JUMP_H = 2.2;
export const JUMP_V = 4 * JUMP_H; // cells / beat  -> airtime of exactly 1 beat
export const GRAVITY = 8 * JUMP_H; // cells / beat^2
export const MAX_FALL = 15;
export const PAD_V = JUMP_V * 1.5; // 1.5 beat airtime
export const ORB_FLIP_V = JUMP_V * 0.45;
export const PAD_FLIP_V = JUMP_V * 0.6;

export const SHIP_UP = 10;
export const SHIP_DOWN = 9;
export const SHIP_MAX = 3.6;

export const HALF = 0.5;
export const INNER = 0.15;
export const SNAP = 0.25;
export const WAVE_HALF = 0.3;
export const WAVE_INNER = 0.14;
export const HAZARD_HALF = 0.44;

export const COYOTE_BEATS = 0.1;
export const SYNC_WINDOW = 0.1; // beats, measured against the 8th-note grid

export const KILL_LOW = -3.5;
export const KILL_HIGH = 22;

export const BUCKET = 4;

export const Kind = { Solid: 0, Spike: 1, Saw: 2, Pad: 3, Orb: 4, Gate: 5, Shard: 6 } as const;
export const Mode = { Cube: 0, Ship: 1, Wave: 2 } as const;
export const Gate = { Cube: 0, Ship: 1, Wave: 2, Flip: 3, Unflip: 4, Speed: 5 } as const;
export const Pad = { Jump: 0, Gravity: 1 } as const;
export const Orb = { Jump: 0, Gravity: 1 } as const;
export const Style = { Block: 0, Ground: 1, Ceiling: 2, Slab: 3 } as const;

export const Ev = {
  Jump: 0,
  Land: 1,
  Orb: 2,
  Pad: 3,
  Gate: 4,
  Shard: 5,
  Death: 6,
  Win: 7,
  Speed: 8,
} as const;
