import { LevelBuilder, type Level } from '../sim/level.ts';

/** 01 — GENESIS. Cube fundamentals: hops, steps, pits and launch pads. 124 BPM. */
export function buildGenesis(): Level {
  const L = new LevelBuilder({
    id: 'genesis', index: 0, name: 'Genesis', tagline: 'Find the pulse. Learn the arc.',
    difficulty: 'Easy', tier: 1, stars: 2, bpm: 124, song: 'genesis',
    mechanics: ['Jump', 'Steps', 'Pits', 'Pads'],
    themes: [
      { sky0: '#04060f', sky1: '#0b2a4a', accent: '#00e5ff', accent2: '#7c5cff', hazard: '#ff3d71' },
      { sky0: '#070416', sky1: '#2a1160', accent: '#5cf2ff', accent2: '#ff4fd8', hazard: '#ff5a5a' },
      { sky0: '#02080d', sky1: '#07353a', accent: '#7dffea', accent2: '#3d9bff', hazard: '#ff3d71' },
    ],
  });

  // ── Intro (0–16): one idea at a time ────────────────────────────────────
  L.text(1, 'TAP TO JUMP', 'Space · Click · Touch');
  L.spikes(6.5);
  L.spikes(9.5).spikes(11.5);
  L.text(12.5, 'JUMP ON THE BEAT', 'Synced jumps build your streak');
  L.spikes(14.5, 2);

  // ── Build (16–32): blocks and stairs ────────────────────────────────────
  L.block(17.5, 19.5, 0, 1);
  L.spikes(21.5);
  L.block(23.5, 24.5, 0, 1).block(24.5, 25.5, 0, 2).block(25.5, 27.5, 0, 3);
  L.spikes(30.5);

  // ── Drop A (32–64) ──────────────────────────────────────────────────────
  L.theme(32, 1).flash(32);
  L.pitAt(33.5, 3);
  L.spikes(35.5).spikes(36.5).spikes(37.5);
  L.spikes(39.5, 2);
  L.text(40, 'HOLD TO KEEP HOPPING');
  for (let b = 41; b <= 46; b++) L.pitAt(b + 0.5, 2.5);
  L.text(47.5, 'PADS LAUNCH YOU');
  L.pad(49).block(49.5, 50, 0, 3);
  L.spikes(52.5);
  L.pad(54).block(54.5, 57.5, 0, 3).spikes(56.5, 1, 3);
  L.spikes(59.5).spikes(60.5);
  L.spikes(62.5, 2);

  // ── Break (64–80) ───────────────────────────────────────────────────────
  L.theme(64, 2);
  L.block(65.5, 67.5, 0, 1).block(67.5, 70.5, 0, 2).spikes(69.5, 1, 2);
  L.shard(72.5, 2.9);
  L.spikes(74.5);
  L.spikes(76.5, 2);
  L.pad(78).spikes(78.75, 4);

  // ── Build (80–96) ───────────────────────────────────────────────────────
  L.spikes(81.5).spikes(82.5).spikes(83.5);
  L.pitAt(85.5, 3);
  L.spikes(86.5, 2);
  L.block(88.5, 89.5, 0, 1).block(89.5, 90.5, 0, 2).block(90.5, 92.25, 0, 3);
  L.pad(92, 3).pit(92.4, 93.3).spikes(94.75);

  // ── Drop B (96–128) ─────────────────────────────────────────────────────
  L.theme(96, 1).flash(96);
  L.spikes(97.5).spikes(98.5).spikes(99.5, 2);
  // Fork: stay low for a free run, or climb for the shard.
  L.block(101.5, 102.5, 0, 1).slab(102.5, 107, 2.5).spikes(104.5, 1, 2.5).shard(106.5, 5.2);
  L.spikes(109.5).spikes(110.5);
  L.pad(112).block(112.5, 113, 0, 3);
  L.pad(114).block(114.5, 115, 0, 3);
  L.spikes(116.5, 2);
  for (let b = 118; b <= 120; b++) L.pitAt(b + 0.5, 2.5);
  // Optional launch from the floating slab.
  L.slab(122.5, 123.5, 2).pad(123, 2).shard(123.75, 7.1);
  L.spikes(125.5).spikes(126.5, 2);
  L.end(128);
  return L.build();
}
