import { LevelBuilder, type Level } from '../sim/level.ts';

/** 02 — VELOCITY. Orbs, speed gates and timed saws. 136 BPM. */
export function buildVelocity(): Level {
  const L = new LevelBuilder({
    id: 'velocity', index: 1, name: 'Velocity', tagline: 'Chain the orbs. Ride the tempo.',
    difficulty: 'Normal', tier: 2, stars: 4, bpm: 136, song: 'velocity',
    mechanics: ['Orbs', 'Speed gates', 'Saws'],
    themes: [
      { sky0: '#03050f', sky1: '#0a2358', accent: '#3d9bff', accent2: '#00ffc6', hazard: '#ff5a36' },
      { sky0: '#05030f', sky1: '#16206e', accent: '#59c2ff', accent2: '#b96bff', hazard: '#ff4d6d' },
      { sky0: '#020a0c', sky1: '#053b45', accent: '#00ffc6', accent2: '#3d9bff', hazard: '#ff5a36' },
      { sky0: '#0b0312', sky1: '#3b0f5c', accent: '#8fd3ff', accent2: '#ff4fd8', hazard: '#ff6b3d' },
    ],
  }, [[32, 1.25], [64, 1], [96, 1.25], [128, 1.5]]);

  // ── Intro (0–16) ────────────────────────────────────────────────────────
  L.spikes(4.5).spikes(6.5, 2);
  L.text(8, 'ORBS', 'Tap again while you pass through');
  L.pit(10.375, 11.625).orb(11, 0.6);
  L.spikes(13.5).spikes(14.5, 2);

  // ── Build (16–32) ───────────────────────────────────────────────────────
  L.pit(17.375, 19.625).orb(18, 0.6).orb(19, 0.6);
  L.spikes(21.5).spikes(22.5);
  L.pad(24).orb(25, 4.9).pit(25.6, 28).slab(25.75, 28.5, 3).spikes(27.5, 1, 3);
  L.spikes(30.5, 2);

  // ── Drop A (32–64) · 1.25x ──────────────────────────────────────────────
  L.theme(32, 1).flash(32);
  L.spikes(33.5, 3).spikes(34.5, 3);
  L.spikes(36.5, 2);
  L.text(37, 'WAIT FOR IT', 'Saws move with the beat');
  L.bobSaw(38, 3.8, 1, 1.4, 2);
  L.spikes(39.5, 3);
  for (let b = 41; b <= 44; b++) L.pitAt(b + 0.5, 3.5);
  L.pad(46).block(46.4, 46.9, 0, 3);
  L.pit(48.35, 51.65).orb(49, 0.6).orb(50, 0.6).orb(51, 0.6);
  L.spikes(53.5, 3).spikes(54.5, 3);
  L.block(56.5, 57.5, 0, 1).block(57.5, 58.5, 0, 2).block(58.5, 60.4, 0, 3);
  L.pad(60, 3).orb(61, 7.9).shard(61.5, 10.1);
  L.spikes(63.5, 2);

  // ── Break (64–80) · 1x ──────────────────────────────────────────────────
  L.theme(64, 2);
  L.spikes(66).spikes(68);
  L.bobSaw(70, 4.4, 1, 1.6, 2).shard(70, 2.1);
  L.spikes(71.5);
  L.pit(72.4, 77.6);
  for (let b = 73; b <= 77; b++) L.slabAt(b, 1.5, 1);
  L.spikes(79.5);

  // ── Build (80–96) ───────────────────────────────────────────────────────
  L.spikes(81.5).spikes(82.5, 2).spikes(83.5);
  L.pit(85.375, 86.625).orb(86, 0.6);
  L.spikes(88);
  L.spikes(89.5, 2);
  L.pad(91).orb(92, 4.9).orb(92.5, 7.1).pit(92.6, 95.2).slab(93.25, 95.5, 6);

  // ── Drop B (96–128) · 1.25x ─────────────────────────────────────────────
  L.theme(96, 1).flash(96);
  L.spikes(97.5, 3).spikes(98.5, 3).spikes(99.5, 3);
  L.bobSaw(101, 3.8, 1, 1.4, 2);
  L.spikes(102.5, 3);
  // Fork: hop on the launcher for the high road and the last shard.
  L.slab(104.5, 105.5, 2).pad(105.2, 2);
  L.slab(106.2, 109, 5).spikes(107.5, 1, 5).shard(108.5, 7.9);
  L.spikes(106.5).spikes(107.5);
  L.spikes(110.5, 3);
  L.pit(112.3, 115.7).orb(113, 0.6).orb(114, 0.6).orb(115, 0.6);
  L.spikes(117.5, 3).spikes(118.5, 3);
  L.pad(120).block(120.4, 120.9, 0, 3);
  L.spikes(123, 3);
  L.spikes(124.5, 2);
  for (let b = 125; b <= 127; b++) L.pitAt(b + 0.5, 3.5);

  // ── Finale (128–144) · 1.5x ─────────────────────────────────────────────
  L.theme(128, 3).flash(128);
  L.spikes(129.5, 3).spikes(130.5, 3);
  L.spikes(132.5, 3).spikes(133.5, 3);
  L.pit(135.3, 137.7).orb(136, 0.6).orb(137, 0.6);
  L.spikes(139.5, 3).spikes(140.5, 4);
  L.spikes(142.5, 3);
  L.end(144);
  return L.build();
}
