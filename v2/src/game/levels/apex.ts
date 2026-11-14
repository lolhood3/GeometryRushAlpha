import { Gate } from '../sim/constants.ts';
import { LevelBuilder, type Level } from '../sim/level.ts';

/** 05 — APEX. Every mechanic, at full speed. 164 BPM. */
export function buildApex(): Level {
  const L = new LevelBuilder({
    id: 'apex', index: 4, name: 'Apex', tagline: 'Everything you know. Faster.',
    difficulty: 'Insane', tier: 5, stars: 10, bpm: 164, song: 'apex',
    mechanics: ['All vehicles', '1.5x speed', 'Gravity'],
    themes: [
      { sky0: '#020a08', sky1: '#064a3a', accent: '#2bffb1', accent2: '#e8ff59', hazard: '#ff3366' },
      { sky0: '#04080a', sky1: '#0a4d5c', accent: '#59ffe0', accent2: '#3d9bff', hazard: '#ff4d4d' },
      { sky0: '#0a0a03', sky1: '#4a4a06', accent: '#e8ff59', accent2: '#2bffb1', hazard: '#ff3366' },
      { sky0: '#0b0306', sky1: '#5c0a24', accent: '#ffffff', accent2: '#2bffb1', hazard: '#ff2e63' },
    ],
  }, [[32, 1.25], [64, 1], [96, 1.25], [128, 1.5], [160, 1.25], [176, 1.5]]);

  const wall = (ceil: number, w: number) => (beat: number, c: number, size: number) => {
    L.block(beat - w / 2, beat + w / 2, 0, c - size / 2);
    L.block(beat - w / 2, beat + w / 2, c + size / 2, ceil);
  };
  const wgap = wall(9, 0.25);
  const gap = wall(10, 0.4);

  // ── Intro (0–16) ────────────────────────────────────────────────────────
  L.spikes(2.5, 2).spikes(3.5, 2);
  L.spikes(5).spikes(6);
  L.block(7.5, 9.5, 0, 1).spikes(8.5, 1, 1);
  L.pit(10.375, 12.625).orb(11, 0.6).orb(12, 0.6);
  L.spikes(14.5, 2);

  // ── Build (16–32) ───────────────────────────────────────────────────────
  L.gravPad(17).slab(16.75, 23.25, 4.5).pit(17.4, 22.6);
  L.spikesDown(18.5, 1, 4).spikesDown(19.5, 2, 4).spikesDown(21, 1, 4).spikesDown(22, 1, 4);
  L.gravPad(22.75, 4, true);
  L.spikes(24.5, 2);
  L.pad(26).orb(27, 4.9).orb(27.5, 7.1).pit(27.6, 30.2).slab(28.25, 30.5, 6).spikes(29.5, 1, 6);

  // ── Drop A (32–64): ship · 1.25x ────────────────────────────────────────
  L.theme(32, 1).flash(32);
  L.gate(32, Gate.Ship).ceiling(31.5, 64.25, 10);
  gap(34.5, 4, 3.6); gap(36, 7, 3.6); gap(37.5, 4, 3.4); gap(39, 6.5, 3.4); gap(40.5, 3, 3.4);
  L.saw(42.5, 6, 1.4).saw(44, 3.5, 1.4);
  L.gate(45, Gate.Flip, 5);
  gap(46.5, 6, 3.6); gap(48, 3.5, 3.6); gap(49.5, 6.5, 3.6);
  L.gate(51, Gate.Unflip, 5);
  L.spikeStrip(52, 58, 0).spikeStrip(52, 58, 10, true);
  L.saw(53, 2.5, 1.4).saw(55.5, 5.4, 1.4).shard(55.5, 8.6).saw(58, 3, 1.4);
  gap(59.5, 5, 3.4); gap(61, 2.8, 3.4); gap(62.5, 2.6, 4);
  L.gate(64, Gate.Cube, 2);

  // ── Inversion (64–80) · 1x ──────────────────────────────────────────────
  L.theme(64, 2);
  L.spikes(66.5, 2).spikes(67.5, 2);
  L.gate(69, Gate.Flip).ceiling(68.5, 76.5, 5).pit(69.4, 75.6);
  L.spikesDown(71.5, 2, 5).spikesDown(72.5, 2, 5).spikesDown(74, 1, 5).spikesDown(75, 1, 5);
  L.gate(76, Gate.Unflip);
  L.spikes(78.5, 2);

  // ── Wave (80–96) ────────────────────────────────────────────────────────
  L.gate(80, Gate.Wave).ceiling(79.5, 96.25, 9);
  wgap(82.5, 3, 3.2); wgap(84, 6, 3.2); wgap(85.5, 3, 3); wgap(87, 5.5, 3); wgap(88.5, 2.8, 3);
  L.shard(89.25, 7.7);
  wgap(90, 5.5, 3);
  L.saw(91.75, 4.5, 1.3);
  wgap(93.5, 5, 3); wgap(95, 2.6, 3.2);
  L.gate(96, Gate.Cube, 2);

  // ── Drop B (96–128) · 1.25x ─────────────────────────────────────────────
  L.theme(96, 1).flash(96);
  L.spikes(98.5, 3).spikes(99.5, 3).spikes(100.5, 3);
  L.pit(102.3, 105.7).orb(103, 0.6).orb(104, 0.6).orb(105, 0.6);
  L.spikes(107.5, 3);
  L.pad(109).block(109.4, 109.9, 0, 3);
  L.gate(112, Gate.Ship).ceiling(111.5, 128.25, 10);
  gap(114.5, 4, 3.4); gap(116, 7, 3.4); gap(117.5, 3.5, 3.4); gap(119, 6.5, 3.2); gap(120.5, 3, 3.2);
  L.saw(122.5, 5, 1.5);
  gap(124.5, 6, 3.2); gap(126, 3, 3.4);
  L.gate(128, Gate.Cube, 2);

  // ── Overclock (128–160) · 1.5x ──────────────────────────────────────────
  L.theme(128, 3).flash(128);
  L.spikes(130.5, 4).spikes(131.5, 4).spikes(132.5, 4);
  L.spikes(134.5, 3).spikes(135.5, 3);
  L.pad(137).block(137.35, 137.75, 0, 2.5);
  L.pit(140.3, 143.7).orb(141, 0.6).orb(142, 0.6).orb(143, 0.6);
  L.gravPad(145).slab(144.8, 151.2, 4.5).pit(145.4, 150.6);
  L.spikesDown(146.5, 3, 4).spikesDown(147.5, 3, 4).spikesDown(148.5, 4, 4).spikesDown(149.5, 3, 4);
  L.gravPad(150.75, 4, true);
  L.spikes(152.5, 4).orb(152.5, 2.7).shard(153, 5.1);
  L.spikes(155, 3);
  L.spikes(156.5, 4);
  L.pitAt(157.5, 4).pitAt(158.5, 4);

  // ── Wave (160–176) · 1.25x ──────────────────────────────────────────────
  L.theme(160, 1).flash(160);
  L.gate(160, Gate.Wave).ceiling(159.5, 192.25, 9.01);
  wgap(162, 3, 3.2); wgap(163.5, 6, 3.2); wgap(165, 3, 3); wgap(166.5, 6, 3); wgap(168, 3, 3); wgap(169.5, 5.5, 3); wgap(171, 3, 3);
  L.saw(172.5, 6, 1.3);
  wgap(174, 4, 3); wgap(175.2, 3.2, 3.4);

  // ── Final flight (176–192) · 1.5x ───────────────────────────────────────
  L.theme(176, 3).flash(176);
  L.gate(176, Gate.Ship, 3);
  const g9 = wall(9, 0.4);
  g9(178.5, 4, 3.4); g9(180, 6.5, 3.4); g9(181.5, 4, 3.2); g9(183, 6, 3.2);
  L.gate(184, Gate.Flip, 4.5);
  g9(185.5, 5.5, 3.4); g9(187, 3, 3.4);
  L.gate(188.5, Gate.Unflip, 4.5);
  g9(190, 3, 3.6);
  L.gate(192, Gate.Cube, 2);

  // ── Apex (192–208) · 1.5x ───────────────────────────────────────────────
  L.theme(192, 0).flash(192);
  L.spikes(194.5, 4).spikes(195.5, 4);
  L.pit(197.3, 199.7).orb(198, 0.6).orb(199, 0.6);
  L.spikes(201.5, 4).spikes(202.5, 4).spikes(203.5, 4);
  L.pad(205).spikes(205.75, 6);
  L.end(208);
  return L.build();
}
