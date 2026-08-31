/**
 * Global game configuration parameters and settings for Rush Engine.
 */
export const GAME_CONFIG = {
  title: 'Rush Engine',
  version: '0.1.0',
  targetFps: 60,
  fixedTimeStep: 1 / 60,
  backgroundColor: '#000000',
  maxDpr: 2,
  autoResize: true,
} as const;

export type GameConfig = typeof GAME_CONFIG;
