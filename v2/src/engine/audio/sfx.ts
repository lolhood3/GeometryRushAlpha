import type { AudioEngine } from './engine.ts';
import { midiHz } from './synth.ts';

export type SfxName =
  | 'jump' | 'land' | 'orb' | 'orbGravity' | 'pad' | 'padGravity' | 'gate' | 'speedUp' | 'speedDown'
  | 'shard' | 'death' | 'win' | 'checkpoint' | 'sync'
  | 'hover' | 'click' | 'back' | 'toggle' | 'unlock' | 'deny' | 'start' | 'tick' | 'go' | 'equip';

/**
 * Synthesised one-shot effects, all routed through the SFX bus. Gameplay
 * pings are pitched from a pentatonic set so they sit musically over any of
 * the level tracks.
 */
export class Sfx {
  private readonly audio: AudioEngine;
  private lastHover = 0;
  /** MIDI root the melodic effects are tuned to (set per level). */
  root = 57;
  private step = 0;

  constructor(audio: AudioEngine) {
    this.audio = audio;
  }

  private tone(
    type: OscillatorType, f0: number, f1: number, dur: number, gain: number,
    opts: { delay?: number; attack?: number; filter?: number } = {},
  ): void {
    const a = this.audio;
    const ctx = a.ctx!;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      o.connect(f).connect(g);
    } else {
      o.connect(g);
    }
    g.connect(a.sfx);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(
    dur: number, gain: number, type: BiquadFilterType, f0: number, f1: number, delay = 0, q = 1,
  ): void {
    const a = this.audio;
    const ctx = a.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = a.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.03);
  }

  private pent(i: number, octave = 0): number {
    const set = [0, 3, 5, 7, 10];
    const n = ((i % set.length) + set.length) % set.length;
    return midiHz(this.root + 12 * (octave + Math.floor(i / set.length)) + set[n]);
  }

  play(name: SfxName, arg = 0): void {
    const a = this.audio;
    if (!a.running) return;
    switch (name) {
      case 'jump':
        this.tone('triangle', 330, 520, 0.07, 0.07);
        break;
      case 'sync':
        // Rewarding chime that climbs with the streak.
        this.tone('sine', this.pent(arg % 10, 2), this.pent(arg % 10, 2), 0.16, 0.085);
        break;
      case 'land':
        this.noise(0.05, 0.05, 'lowpass', 500, 120);
        break;
      case 'orb': {
        const hz = this.pent(this.step++ % 5, 1);
        this.tone('sine', hz, hz, 0.26, 0.16);
        this.tone('triangle', hz * 2, hz * 2, 0.12, 0.06);
        break;
      }
      case 'orbGravity':
        this.tone('sine', 880, 220, 0.24, 0.16);
        this.tone('triangle', 440, 1320, 0.18, 0.05, { delay: 0.02 });
        break;
      case 'pad':
        this.tone('sawtooth', 180, 720, 0.16, 0.11, { filter: 2400 });
        this.tone('sine', 360, 1080, 0.2, 0.08);
        break;
      case 'padGravity':
        this.tone('sawtooth', 700, 150, 0.22, 0.1, { filter: 2000 });
        this.tone('sine', 200, 900, 0.22, 0.08, { delay: 0.03 });
        break;
      case 'gate':
        this.noise(0.4, 0.12, 'bandpass', 500, 5200, 0, 2.2);
        this.tone('sine', this.pent(0, 1), this.pent(2, 1), 0.3, 0.1);
        break;
      case 'speedUp':
        this.tone('sawtooth', 220, 1400, 0.22, 0.07, { filter: 3000 });
        this.noise(0.22, 0.07, 'highpass', 1500, 6000);
        break;
      case 'speedDown':
        this.tone('sawtooth', 1200, 200, 0.26, 0.07, { filter: 2600 });
        break;
      case 'shard':
        [0, 2, 4, 7].forEach((d, i) => this.tone('sine', this.pent(d, 2), this.pent(d, 2), 0.3, 0.1, { delay: i * 0.055 }));
        this.noise(0.25, 0.04, 'highpass', 6000, 9000);
        break;
      case 'death':
        this.noise(0.5, 0.36, 'lowpass', 5200, 140);
        this.tone('sawtooth', 300, 38, 0.48, 0.2, { filter: 1500 });
        this.tone('square', 120, 30, 0.3, 0.12, { filter: 700 });
        break;
      case 'win':
        [0, 2, 4, 5, 7].forEach((d, i) => {
          this.tone('triangle', this.pent(d, 1), this.pent(d, 1), 1.3, 0.11, { delay: i * 0.07, attack: 0.01 });
          this.tone('sine', this.pent(d, 2), this.pent(d, 2), 1.0, 0.05, { delay: i * 0.07 + 0.02 });
        });
        this.noise(1.1, 0.1, 'highpass', 3000, 9000);
        break;
      case 'checkpoint':
        this.tone('sine', this.pent(2, 1), this.pent(4, 1), 0.14, 0.08);
        break;
      case 'hover': {
        const now = performance.now();
        if (now - this.lastHover < 45) return;
        this.lastHover = now;
        this.tone('sine', 1500, 1700, 0.035, 0.022);
        break;
      }
      case 'click':
        this.tone('triangle', 620, 930, 0.07, 0.09);
        this.tone('sine', 1240, 1860, 0.05, 0.035, { delay: 0.012 });
        break;
      case 'back':
        this.tone('triangle', 720, 400, 0.09, 0.08);
        break;
      case 'toggle':
        this.tone('square', arg ? 660 : 440, arg ? 990 : 330, 0.06, 0.035, { filter: 2400 });
        break;
      case 'equip':
        this.tone('triangle', 520, 780, 0.08, 0.09);
        this.tone('sine', 1040, 1560, 0.12, 0.05, { delay: 0.05 });
        break;
      case 'unlock':
        [0, 2, 4, 7].forEach((d, i) => this.tone('triangle', this.pent(d, 1), this.pent(d, 1), 0.34, 0.1, { delay: i * 0.075 }));
        break;
      case 'deny':
        this.tone('square', 150, 110, 0.14, 0.06, { filter: 900 });
        break;
      case 'start':
        this.noise(0.5, 0.14, 'bandpass', 300, 7000, 0, 1.6);
        this.tone('sine', 90, 45, 0.5, 0.3, { delay: 0.3 });
        break;
      case 'tick':
        this.tone('square', 880, 880, 0.06, 0.07, { filter: 3200 });
        break;
      case 'go':
        this.tone('square', 1320, 1320, 0.16, 0.08, { filter: 4200 });
        break;
    }
  }
}
