import { Gate } from '../sim/constants.ts';
import { LevelBuilder, type Level } from '../sim/level.ts';

/** 03 — OVERDRIVE. Gravity pads and the first flight. 144 BPM. */
export function buildOverdrive(): Level {
  const L = new LevelBuilder({
    id: 'overdrive', index: 2, name: 'Overdrive', tagline: 'Leave the ground behind.',
    difficulty: 'Hard', tier: 3, stars: 6, bpm: 144, song: 'overdrive',
    mechanics: ['Ship', 'Gravity pads'],
    themes: [
      { sky0: '#0b0503', sky1: '#4a1d06', accent: '#ffb627', accent2: '#ff6b35', hazard: '#ff2e7e' },
      { sky0: '#0d0308', sky1: '#5a0f2a', accent: '#ffd166', accent2: '#ff3d71', hazard: '#f72585' },
      { sky0: '#06060d', sky1: '#27204f', accent: '#ffc857', accent2: '#8b7bff', hazard: '#ff2e7e' },
    ],
  }, [[96, 1.25]]);
  const CEIL = 10;
  /** Wall with an opening `size` tall centred on height `c`. */
  const gap = (beat: number, c: number, size: number, w = 0.5) => {
    L.block(beat - w / 2, beat + w / 2, 0, c - size / 2);
    L.block(beat - w / 2, beat + w / 2, c + size / 2, CEIL);
  };

  // ── Intro (0–16) ────────────────────────────────────────────────────────
  L.spikes(3.5).spikes(4.5);
  L.spikes(6, 2);
  L.block(7.5, 9.5, 0, 1).spikes(8.5, 1, 1);
  L.spikes(11.5, 2);
  L.pitAt(13.5, 3).spikes(14.5, 2);

  // ── Build (16–32): gravity pads ─────────────────────────────────────────
  L.text(16, 'BLUE FLIPS GRAVITY', 'Jump away from the ceiling');
  L.gravPad(18).slab(17.75, 23.25, 4.5);
  L.spikesDown(19.5, 1, 4).spikesDown(20.5, 1, 4).spikesDown(21.5, 2, 4);
  L.gravPad(22.75, 4, true);
  L.spikes(24.5).spikes(25.5, 2);
  L.gravPad(27).slab(26.75, 31.5, 4.5).pit(27.4, 30.6);
  L.spikesDown(28.5, 2, 4).spikesDown(29.5, 1, 4);
  L.gravPad(31, 4, true);

  // ── Drop A (32–64): ship ────────────────────────────────────────────────
  L.text(31.5, 'SHIP', 'Hold to climb · release to dive');
  L.theme(32, 1).flash(32);
  L.gate(32, Gate.Ship).ceiling(31.5, 60.25, CEIL);
  gap(36, 3, 5); gap(38, 6, 5); gap(40, 4, 4.5); gap(42, 6.5, 4.5);
  L.saw(44, 5, 1.2);
  gap(46, 3, 4); gap(48, 6, 4); gap(50, 3.5, 4);
  L.spikeStrip(51, 55, 0).spikeStrip(51, 55, CEIL, true);
  L.saw(52, 2.6, 1.3).shard(52, 8.7).saw(54, 7.4, 1.3);
  gap(56, 5, 4); gap(58, 2.6, 4);
  L.gate(60, Gate.Cube, 2);
  L.spikes(62.5, 2);

  // ── Break (64–80) ───────────────────────────────────────────────────────
  L.theme(64, 2);
  L.spikes(66).spikes(67);
  L.pit(68.375, 70.625).orb(69, 0.6).orb(70, 0.6);
  L.pad(72).orb(73, 4.9).pit(73.6, 76).slab(73.75, 76.5, 3).spikes(75.5, 1, 3);
  L.orb(76.75, 5.6).shard(77.25, 7.9);
  L.spikes(78.75, 2);

  // ── Build (80–96): long inverted run ────────────────────────────────────
  L.gravPad(81).slab(80.75, 88.25, 4.5).pit(81.4, 87.4);
  L.spikesDown(82.5, 1, 4).spikesDown(83.5, 2, 4).spikesDown(85, 1, 4).spikesDown(86.5, 2, 4);
  L.gravPad(87.75, 4, true);
  L.spikes(89.5, 2).spikes(90.5);
  L.pad(92).block(92.5, 93, 0, 3);
  L.spikes(94.5, 2);

  // ── Drop B (96–140) · 1.25x ─────────────────────────────────────────────
  L.theme(96, 1).flash(96);
  L.spikes(97.5, 3).spikes(98.5, 3);
  L.pit(100.3, 103.7).orb(101, 0.6).orb(102, 0.6).orb(103, 0.6);
  L.spikes(105.5, 3).spikes(106.5, 3).spikes(107.5, 3);
  L.pad(109).block(109.4, 109.9, 0, 3);
  L.gate(112, Gate.Ship).ceiling(111.5, 140.25, CEIL);
  gap(115, 4, 4); gap(117, 7, 4); gap(119, 3, 4); gap(121, 6, 3.6);
  L.spikeStrip(122, 126, 0).spikeStrip(122, 126, CEIL, true);
  L.saw(123, 3, 1.3).saw(125, 5.6, 1.3).shard(125, 8.7);
  gap(127, 5, 3.6); gap(129, 2.6, 3.6); gap(131, 6.5, 3.6); gap(133, 4, 3.6); gap(135, 7, 3.6);
  gap(137.5, 2.6, 4);
  L.gate(140, Gate.Cube, 2);

  // ── Finale (140–160) ────────────────────────────────────────────────────
  L.theme(140, 0).flash(140);
  L.spikes(142.5, 3).spikes(143.5, 3);
  L.gravPad(145).slab(144.75, 150.25, 4.5).pit(145.4, 149.6);
  L.spikesDown(146.5, 2, 4).spikesDown(147.5, 2, 4).spikesDown(148.5, 3, 4);
  L.gravPad(149.75, 4, true);
  L.spikes(151.5, 3);
  L.pit(152.3, 154.7).orb(153, 0.6).orb(154, 0.6);
  L.spikes(156.5, 3).spikes(157.5, 3);
  L.end(160);
  return L.build();
}
