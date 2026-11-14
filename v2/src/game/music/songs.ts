import type { Song, SongSection } from '../../engine/audio/music.ts';

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

const K4 = 'x...x...x...x...';
const K1 = 'x...............';
const K2 = 'x.......x.......';
const S24 = '....x.......x...';
const H_OFF = '..x...x...x...x.';
const H_8 = 'x.o.x.o.x.o.x.o.';
const H_16 = 'xoxoxoXoxoxoxoXo';

interface Motifs {
  chords: number[];
  bassSoft: string;
  bassDrive: string;
  arp: string;
  leadA: string;
  leadB: string;
}

/** Shared arrangement vocabulary; each song supplies its own motifs. */
function parts(m: Motifs) {
  const base = { chords: m.chords };
  return {
    intro: (bars: number): SongSection => ({
      ...base, name: 'intro', bars, kick: K1, hat: H_OFF, arp: m.arp, pad: 1, energy: 0.3,
    }),
    build: (bars: number): SongSection => ({
      ...base, name: 'build', bars, kick: K4, hat: H_8, bass: m.bassSoft, arp: m.arp, pad: 0.8,
      energy: 0.6, riser: Math.min(2, bars), fill: true,
    }),
    drop: (bars: number, variant: 'A' | 'B' = 'A'): SongSection => ({
      ...base, name: 'drop', bars, kick: K4, snare: S24, hat: H_16, bass: m.bassDrive, arp: m.arp,
      lead: variant === 'A' ? m.leadA : m.leadB, pad: 0.7, energy: 1, impact: true,
    }),
    breakdown: (bars: number): SongSection => ({
      ...base, name: 'break', bars, kick: K2, hat: H_OFF, lead: m.leadA, pad: 1.2, energy: 0.4, impact: true,
    }),
    lift: (bars: number): SongSection => ({
      ...base, name: 'lift', bars, kick: K4, snare: S24, hat: H_16, bass: m.bassDrive, arp: m.arp,
      lead: m.leadB, pad: 0.7, energy: 1, impact: true, riser: 1,
    }),
  };
}

function genesis(): Song {
  const p = parts({
    chords: [0, 5, 2, 6],
    bassSoft: '..0...0...0...0.',
    bassDrive: '0.00.0.00.0.0.7.',
    arp: '0247420247420247',
    leadA: '4..4..7.6.4...2. 5..5..7.6.4...4. 2..4..6.4.2...1. 6..4..2.1.2.4...',
    leadB: '7.9.b.9.7.9.b.9. 5.7.9.7.5.7.9.7. 6.9.b.9.6.9.b.9. 6.8.a.8.6.8.a.b.',
  });
  return {
    id: 'genesis', bpm: 124, root: 45, scale: MINOR, leadWave: 'sawtooth',
    sections: [p.intro(4), p.build(4), p.drop(8, 'A'), p.breakdown(4), p.build(4), p.drop(8, 'B')],
  };
}

function velocity(): Song {
  const p = parts({
    chords: [0, 3, 5, 4],
    bassSoft: '..0...0...0...0.',
    bassDrive: '0.000.000.000.07',
    arp: '0427042704270427',
    leadA: '7..7..6.7..4..2. 3..3..5.7..5..3. 5..5..7.9..7..5. 4..4..6.8..6.4.2',
    leadB: '7.b.9.7.b.9.7.4. 7.a.8.7.a.8.7.3. 9.c.b.9.c.b.9.5. 8.b.a.8.b.a.8.6.',
  });
  return {
    id: 'velocity', bpm: 136, root: 38, scale: MINOR, leadWave: 'square',
    sections: [p.intro(4), p.build(4), p.drop(8, 'A'), p.breakdown(4), p.build(4), p.drop(8, 'B'), p.lift(4)],
  };
}

function overdrive(): Song {
  const p = parts({
    chords: [0, 1, 0, 6],
    bassSoft: '0..0..0.0..0..0.',
    bassDrive: '0.070.070.07070.',
    arp: '0407040704070407',
    leadA: '0.0.1.0.3.0.1.0. 1.1.3.1.4.1.3.1. 0.0.1.0.3.0.4.3. 6.6.7.6.8.7.6.4.',
    leadB: '7.7.8.7.a.7.8.7. 8.8.a.8.b.8.a.8. 7.7.8.7.a.7.b.a. d.d.c.b.a.8.7.6.',
  });
  return {
    id: 'overdrive', bpm: 144, root: 40, scale: PHRYGIAN, leadWave: 'sawtooth',
    sections: [p.intro(4), p.build(4), p.drop(8, 'A'), p.breakdown(4), p.build(4), p.drop(11, 'B'), p.lift(5)],
  };
}

function quantum(): Song {
  const p = parts({
    chords: [0, 5, 3, 4],
    bassSoft: '0.0.0.0.0.0.0.0.',
    bassDrive: '0.070.070.070.07',
    arp: '0274027402740274',
    leadA: '7.4.2.4.7.4.9.4. 7.5.2.5.7.5.9.5. 7.5.3.5.7.5.a.5. 8.6.4.6.8.6.b.6.',
    leadB: 'b.9.7.9.b.9.e.9. c.9.7.9.c.9.e.9. c.a.7.a.c.a.e.a. d.b.8.b.d.b.f.b.',
  });
  return {
    id: 'quantum', bpm: 152, root: 42, scale: HARMONIC, leadWave: 'square',
    sections: [
      p.intro(4), p.build(4), p.drop(8, 'A'), p.breakdown(4), p.build(4),
      p.drop(8, 'B'), p.lift(4), p.drop(4, 'A'), p.lift(4),
    ],
  };
}

function apex(): Song {
  const p = parts({
    chords: [0, 6, 5, 4],
    bassSoft: '0..0..0.0..0..0.',
    bassDrive: '0.000.000.000.00',
    arp: '0247974202479742',
    leadA: 'b.9.7.9.b.9.7.4. a.8.6.8.a.8.6.3. 9.7.5.7.9.7.5.2. 8.6.4.6.8.6.b.a.',
    leadB: 'b..b..e.d.b...9. a..a..d.c.a...8. 9..9..c.b.9...7. 8..8..b.a.8.a.b.',
  });
  return {
    id: 'apex', bpm: 164, root: 36, scale: MINOR, leadWave: 'sawtooth',
    sections: [
      p.intro(4), p.build(4), p.drop(8, 'A'), p.breakdown(4), p.build(4),
      p.drop(8, 'B'), p.lift(8), p.drop(4, 'A'), p.lift(4), p.drop(4, 'B'),
    ],
  };
}

/** Looping ambient piece for the menus. */
function menu(): Song {
  const chords = [0, 5, 3, 4];
  const a: SongSection = {
    name: 'menu-a', bars: 8, chords, kick: K2, hat: '..x...x...x...xo', arp: '0...4...7...4...', pad: 1.5,
    bass: '0-------........', energy: 0.35,
  };
  const b: SongSection = {
    name: 'menu-b', bars: 8, chords, kick: 'x.....x...x.....', hat: H_8, arp: '0.4.7.4.9.7.4.2.', pad: 1.4,
    bass: '0-----0-0-------', lead: '4-------7---6--- 5-------9---7--- 3-------7---5--- 4---6---8-------',
    energy: 0.5,
  };
  return { id: 'menu', bpm: 104, root: 45, scale: MINOR, leadWave: 'triangle', sections: [a, b], loop: true };
}

/** Plain click track for the latency calibration tool. */
function metronome(): Song {
  return {
    id: 'metronome', bpm: 120, root: 57, scale: MINOR, leadWave: 'square', loop: true,
    sections: [{ name: 'click', bars: 1, chords: [0], kick: K4, hat: K4, energy: 1 }],
  };
}

const BUILDERS: Record<string, () => Song> = { genesis, velocity, overdrive, quantum, apex, menu, metronome };
const cache = new Map<string, Song>();

export function getSong(id: string): Song {
  let s = cache.get(id);
  if (!s) {
    const b = BUILDERS[id];
    if (!b) throw new Error(`Unknown song: ${id}`);
    s = b();
    cache.set(id, s);
  }
  return s;
}
