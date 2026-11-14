import type { AudioEngine } from './engine.ts';
import { bass, hat, impact, kick, lead, midiHz, pad, pluck, riser, snare, type Group } from './synth.ts';

/**
 * Pattern notation
 *   drums  – 16 characters per bar: `x` hit, `o` ghost hit, `.` rest
 *   notes  – 16 characters per bar: `0-9 a-e` scale degree, `-` sustain, `.` rest
 * Patterns may span several bars and repeat for the length of the section.
 * Spaces are ignored. Bass and arp degrees are relative to the bar's chord,
 * lead degrees are relative to the key.
 */
export interface SongSection {
  name: string;
  bars: number;
  /** Scale degree of the chord root for each bar (cycled). */
  chords: number[];
  kick?: string;
  snare?: string;
  hat?: string;
  bass?: string;
  arp?: string;
  lead?: string;
  pad?: number;
  /** 0..1 – how intense the visuals should be. */
  energy: number;
  /** Noise riser covering this many bars at the end of the section. */
  riser?: number;
  /** Crash + sub drop on the first beat. */
  impact?: boolean;
  /** Snare roll through the last bar. */
  fill?: boolean;
}

export interface Song {
  id: string;
  bpm: number;
  /** MIDI note of the tonic in the bass register. */
  root: number;
  scale: number[];
  leadWave: OscillatorType;
  sections: SongSection[];
  loop?: boolean;
}

interface Compiled {
  song: Song;
  stepDur: number;
  totalSteps: number;
  /** First step of each section. */
  starts: number[];
  kickAt: Uint8Array;
  energyAt: Float32Array;
}

const FILL = 'x...x...x.x.xxxx';
const clean = (s: string | undefined): string => (s ? s.replace(/\s+/g, '') : '');

function degreeOf(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 97 && c <= 122) return c - 87;
  return NaN;
}

function compileSong(song: Song): Compiled {
  const starts: number[] = [];
  let total = 0;
  for (const s of song.sections) { starts.push(total); total += s.bars * 16; }
  const kickAt = new Uint8Array(total + 1);
  const energyAt = new Float32Array(total + 1);
  song.sections.forEach((s, i) => {
    const k = clean(s.kick);
    for (let n = 0; n < s.bars * 16; n++) {
      const step = starts[i] + n;
      energyAt[step] = s.energy;
      if (k && k[n % k.length] !== '.') kickAt[step] = 1;
    }
    if (s.impact) kickAt[starts[i]] = 1;
  });
  kickAt[total] = 1;
  energyAt[total] = 1;
  return { song, stepDur: 60 / song.bpm / 4, totalSteps: total, starts, kickAt, energyAt };
}

const compiled = new Map<Song, Compiled>();
function getCompiled(song: Song): Compiled {
  let c = compiled.get(song);
  if (!c) { c = compileSong(song); compiled.set(song, c); }
  return c;
}

export function songBeats(song: Song): number {
  return getCompiled(song).totalSteps / 4;
}

export interface PlayOptions {
  /** Song position to start from, in seconds. */
  offset?: number;
  /** Seconds from now until that position is heard. */
  delay?: number;
  loop?: boolean;
  fadeIn?: number;
}

/**
 * Sample-accurate step sequencer. Notes are scheduled on the audio clock a
 * short window ahead of time, so timing never depends on frame rate or timer
 * jitter, and the song position can be read back as the game's master clock.
 */
export class MusicPlayer {
  private readonly audio: AudioEngine;
  private cur: Compiled | null = null;
  private group: Group | null = null;
  private t0 = 0;
  private nextStep = 0;
  private loop = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private static readonly LOOKAHEAD = 0.22;

  constructor(audio: AudioEngine) {
    this.audio = audio;
  }

  get playing(): boolean { return this.cur !== null; }
  get song(): Song | null { return this.cur ? this.cur.song : null; }

  play(song: Song, opts: PlayOptions = {}): void {
    this.stop(0.03);
    const a = this.audio;
    if (!a.ctx) return;
    const ctx = a.ctx;
    const c = getCompiled(song);
    const offset = Math.max(0, opts.offset ?? 0);
    const delay = opts.delay ?? 0.06;
    this.cur = c;
    this.loop = opts.loop ?? !!song.loop;
    this.t0 = ctx.currentTime + delay - offset;
    this.nextStep = Math.ceil(offset / c.stepDur - 1e-6);

    const out = ctx.createGain();
    const pump = ctx.createGain();
    const rev = ctx.createGain();
    const echo = ctx.createGain();
    rev.gain.value = 0.22;
    echo.gain.value = 0.2;
    pump.connect(out);
    out.connect(a.musicIn);
    rev.connect(a.reverbIn);
    echo.connect(a.delayIn);
    if (opts.fadeIn) {
      out.gain.setValueAtTime(0.0001, ctx.currentTime);
      out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + opts.fadeIn);
    }
    this.group = { out, pump, rev, echo };
    a.delay.delayTime.setValueAtTime((60 / song.bpm) * 0.75, ctx.currentTime);

    this.schedule();
    this.timer = setInterval(() => this.schedule(), 30);
  }

  stop(fade = 0.08): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    const g = this.group;
    const ctx = this.audio.ctx;
    if (g && ctx) {
      const t = ctx.currentTime;
      for (const n of [g.out, g.rev, g.echo]) {
        n.gain.cancelScheduledValues(t);
        n.gain.setValueAtTime(n.gain.value, t);
        n.gain.linearRampToValueAtTime(0, t + fade);
      }
      setTimeout(() => { g.out.disconnect(); g.rev.disconnect(); g.echo.disconnect(); }, fade * 1000 + 700);
    }
    this.group = null;
    this.cur = null;
  }

  /**
   * Position of the sound currently *leaving the speakers*, in seconds.
   * NaN when nothing is playing or the context is not running.
   */
  songTime(): number {
    const a = this.audio;
    if (!this.cur || !a.running) return NaN;
    return a.now - this.t0 - a.latency;
  }

  /** Beat-synchronous visual drivers for an arbitrary song position. */
  analyse(song: Song, time: number, out: { pulse: number; energy: number }): void {
    const c = getCompiled(song);
    let step = Math.floor(time / c.stepDur);
    const last = c.totalSteps;
    const wrap = (n: number) => (song.loop ? ((n % last) + last) % last : Math.max(0, Math.min(last, n)));
    out.energy = c.energyAt[wrap(step)];
    out.pulse = 0;
    for (let back = 0; back < 16; back++, step--) {
      if (step < 0 && !song.loop) break;
      if (c.kickAt[wrap(step)]) {
        const dt = time - step * c.stepDur;
        out.pulse = Math.exp(-dt * 7.5);
        return;
      }
    }
  }

  private schedule(): void {
    const c = this.cur;
    const g = this.group;
    const a = this.audio;
    if (!c || !g || !a.ctx || a.ctx.state !== 'running') return;
    const horizon = a.ctx.currentTime + MusicPlayer.LOOKAHEAD;
    const now = a.ctx.currentTime;
    for (;;) {
      const t = this.t0 + this.nextStep * c.stepDur;
      if (t > horizon) break;
      const idx = this.loop ? this.nextStep % c.totalSteps : this.nextStep;
      if (idx > c.totalSteps) {
        if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
        break;
      }
      // Never play notes whose time has already passed (after a stall).
      // A note that fails to schedule must not stall the sequencer on its step.
      if (t >= now - 0.01) { try { this.emit(c, g, idx, Math.max(t, now)); } catch { /* skip this step */ } }
      this.nextStep++;
    }
  }

  private emit(c: Compiled, g: Group, step: number, t: number): void {
    const a = this.audio;
    const song = c.song;
    const sd = c.stepDur;
    if (step === c.totalSteps) {
      // Final hit: crash and tonic chord ringing out.
      impact(a, g, t);
      kick(a, g, t, 1);
      pad(a, g, t, [0, 2, 4, 7].map((d) => this.hz(song, d, 12)), sd * 24, 1.6);
      return;
    }
    let si = c.starts.length - 1;
    while (si > 0 && c.starts[si] > step) si--;
    const sec = song.sections[si];
    const n = step - c.starts[si];
    const bar = Math.floor(n / 16);
    const inBar = n % 16;
    const chord = sec.chords[bar % sec.chords.length];
    const lastBar = bar === sec.bars - 1;

    if (n === 0 && sec.impact) impact(a, g, t);
    if (sec.riser && inBar === 0 && bar === sec.bars - sec.riser) riser(a, g, t, sec.riser * 16 * sd);

    const k = clean(sec.kick);
    if (k) { const ch = k[n % k.length]; if (ch !== '.') kick(a, g, t, ch === 'o' ? 0.6 : 1); }
    const s = sec.fill && lastBar ? FILL : clean(sec.snare);
    if (s) { const ch = s[n % s.length]; if (ch !== '.') snare(a, g, t, ch === 'o' ? 0.45 : sec.fill && lastBar ? 0.55 + inBar / 40 : 1); }
    const h = clean(sec.hat);
    if (h) { const ch = h[n % h.length]; if (ch !== '.') hat(a, g, t, ch === 'o' ? 0.45 : 1, ch === 'X'); }

    if (sec.pad && inBar === 0) {
      pad(a, g, t, [0, 2, 4].map((d) => this.hz(song, chord + d, 12)), sd * 16, sec.pad);
    }
    const b = clean(sec.bass);
    if (b) this.note(b, n, (deg, len) => bass(a, g, t, this.hz(song, chord + deg, 0), len * sd * 0.92));
    const ar = clean(sec.arp);
    if (ar) this.note(ar, n, (deg) => pluck(a, g, t, this.hz(song, chord + deg, 24), 0.9));
    const l = clean(sec.lead);
    if (l) this.note(l, n, (deg, len) => lead(a, g, t, this.hz(song, deg, 24), len * sd * 0.9, 1, song.leadWave));
  }

  private note(pattern: string, n: number, play: (degree: number, steps: number) => void): void {
    const len = pattern.length;
    const deg = degreeOf(pattern[n % len]);
    if (Number.isNaN(deg)) return;
    let steps = 1;
    while (steps < 16 && pattern[(n + steps) % len] === '-') steps++;
    play(deg, steps);
  }

  private hz(song: Song, degree: number, transpose: number): number {
    const sc = song.scale;
    const oct = Math.floor(degree / sc.length);
    const idx = ((degree % sc.length) + sc.length) % sc.length;
    return midiHz(song.root + transpose + oct * 12 + sc[idx]);
  }
}
