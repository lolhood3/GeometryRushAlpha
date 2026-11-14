import { Gate } from '../sim/constants.ts';
import { LevelBuilder, type Level } from '../sim/level.ts';

/** 04 — QUANTUM. Gravity gates, blue orbs and the wave. 152 BPM. */
export function buildQuantum(): Level {
  const L = new LevelBuilder({
    id: 'quantum', index: 3, name: 'Quantum', tagline: 'Up is a decision.',
    difficulty: 'Harder', tier: 4, stars: 8, bpm: 152, song: 'quantum',
    mechanics: ['Wave', 'Gravity gates', 'Blue orbs'],
    themes: [
      { sky0: '#08030f', sky1: '#3a0d5c', accent: '#c77dff', accent2: '#ff4fd8', hazard: '#ff4d4d' },
      { sky0: '#0c0210', sky1: '#5c0a4a', accent: '#ff6ad5', accent2: '#7b61ff', hazard: '#ffd23f' },
      { sky0: '#03040f', sky1: '#141a5e', accent: '#8e9bff', accent2: '#c77dff', hazard: '#ff4d6d' },
      { sky0: '#0d0208', sky1: '#6a0a3a', accent: '#ff8ad8', accent2: '#ffb627', hazard: '#ff4d4d' },
    ],
  }, [[48, 1.25], [64, 1], [112, 1.25]]);

  const wall = (ceil: number, w: number) => (beat: number, c: number, size: number) => {
    L.block(beat - w / 2, beat + w / 2, 0, c - size / 2);
    L.block(beat - w / 2, beat + w / 2, c + size / 2, ceil);
  };
  const wgap = wall(9, 0.25);
  const gap = wall(10, 0.5);

  // ── Intro (0–16) ────────────────────────────────────────────────────────
  L.spikes(2.5).spikes(3.5, 2);
  L.spikes(5).spikes(6);
  L.pit(7.375, 8.625).orb(8, 0.6);
  L.spikes(10.5, 2);
  L.pad(12).block(12.5, 13, 0, 3);
  L.spikes(14.5, 2);

  // ── Build (16–32): gravity gates & blue orbs ────────────────────────────
  L.text(15.5, 'GRAVITY GATES', 'The world turns over');
  L.gate(17, Gate.Flip).ceiling(16.5, 24.5, 5).pit(17.5, 23.5);
  L.spikesDown(19.5, 1, 5).spikesDown(20.5, 2, 5).spikesDown(22, 1, 5);
  L.gate(24, Gate.Unflip);
  L.spikes(26.5, 2);
  L.text(27, 'BLUE ORBS FLIP TOO');
  L.pit(28.375, 31.3).gravOrb(29, 0.6).slab(28.75, 32.25, 5.5);
  L.spikesDown(30.5, 2, 5);
  L.gravOrb(31.5, 2.3);

  // ── Drop A (32–48): wave ────────────────────────────────────────────────
  L.text(31.25, 'WAVE', 'Hold to rise · release to dive');
  L.theme(32, 1).flash(32);
  L.gate(32, Gate.Wave).ceiling(32.25, 48.25, 9);
  wgap(35, 3, 4); wgap(36.5, 5.5, 4); wgap(38, 3, 3.6); wgap(39.5, 6, 3.6); wgap(41, 3.5, 3.4); wgap(42.5, 6, 3.4);
  L.saw(44, 1.8, 1.2).saw(44, 7.6, 1.2);
  L.saw(45.5, 4.8, 1.3).shard(45.5, 1.4);
  wgap(47, 2.6, 3.6);
  L.gate(48, Gate.Cube, 2);

  // ── Drop A, part two (48–64): inverted sprint · 1.25x ───────────────────
  L.spikes(50.5, 3).spikes(51.5, 3);
  L.gate(53, Gate.Flip).ceiling(52.5, 58.5, 5).pit(53.4, 57.6);
  L.spikesDown(55.5, 3, 5).spikesDown(56.5, 3, 5);
  L.gate(58, Gate.Unflip);
  L.spikes(60.5, 3);
  L.pit(61.3, 62.7).orb(62, 0.6);

  // ── Break (64–80): ship with gravity flips ──────────────────────────────
  L.theme(64, 2);
  L.gate(64, Gate.Ship).ceiling(63.5, 80.25, 10);
  gap(67, 3, 4.5); gap(69, 6.5, 4.5);
  L.gate(70.5, Gate.Flip, 5).shard(71.5, 9);
  gap(72.5, 6, 4.5); gap(74.5, 3.5, 4.5);
  L.gate(76, Gate.Unflip, 5);
  gap(78, 3, 4.5);
  L.gate(80, Gate.Cube, 2);

  // ── Build (80–96) ───────────────────────────────────────────────────────
  L.spikes(82.5, 2).spikes(83.5);
  L.spikes(85).spikes(86);
  L.pit(87.375, 91.3).gravOrb(88, 0.6).slab(87.75, 92.25, 5.5);
  L.spikesDown(89.5, 1, 5).spikesDown(90.5, 2, 5);
  L.gravOrb(91.5, 2.3);
  L.spikes(93.5, 2);

  // ── Drop B (96–112): wave, tighter ──────────────────────────────────────
  L.theme(96, 1).flash(96);
  L.gate(96, Gate.Wave).ceiling(95.5, 112.25, 9);
  wgap(98.5, 3, 3.4); wgap(100, 6, 3.4); wgap(101.5, 3, 3.2); wgap(103, 5.5, 3.2); wgap(104.5, 3, 3.2); wgap(106, 6, 3.2);
  L.saw(107.75, 4.5, 1.4);
  wgap(109.5, 5, 3.2); wgap(111, 2.6, 3.4);
  L.gate(112, Gate.Cube, 2);

  // ── Drop B, part two (112–128) · 1.25x ──────────────────────────────────
  L.spikes(114.5, 3).spikes(115.5, 3).spikes(116.5, 3);
  L.pad(118).orb(119, 4.9).pit(119.6, 122).slab(119.75, 122.5, 3).spikes(121.5, 3, 3);
  L.spikes(124.5, 3).spikes(125.5, 3);

  // ── Ascent (128–144): ship, gravity flips, saw ──────────────────────────
  L.theme(128, 3).flash(128);
  L.gate(128, Gate.Ship).ceiling(127.5, 144.25, 10);
  gap(131, 4, 4); gap(133, 7, 4);
  L.gate(134, Gate.Flip, 5);
  gap(135.5, 3.5, 4); gap(137.5, 6.5, 4);
  L.gate(139, Gate.Unflip, 5);
  L.saw(140.5, 5, 1.4);
  gap(142.5, 2.6, 4);
  L.gate(144, Gate.Cube, 2);

  // ── Inversion (144–160) ─────────────────────────────────────────────────
  L.spikes(146.5, 3).spikes(147.5, 3);
  L.gate(149, Gate.Flip).ceiling(148.5, 156.5, 5).pit(149.4, 155.6);
  L.spikesDown(151.5, 3, 5).spikesDown(152.5, 3, 5).spikesDown(154, 3, 5);
  L.gate(156, Gate.Unflip);
  L.spikes(158.5, 3);

  // ── Finale (160–176): wave at speed ─────────────────────────────────────
  L.theme(160, 1).flash(160);
  L.gate(160, Gate.Wave).ceiling(159.5, 172.25, 9);
  wgap(162, 3, 3.6); wgap(163.5, 6, 3.6);
  L.shard(164.25, 8.2);
  wgap(165, 3, 3.4); wgap(166.5, 6, 3.4); wgap(168, 3.5, 3.4); wgap(169.5, 5.5, 3.4); wgap(171, 2.6, 3.6);
  L.gate(172, Gate.Cube, 2);
  L.spikes(174.5, 3);
  L.end(176);
  return L.build();
}
