import type { AudioEngine } from './engine.ts';

/** Destination nodes for one playing piece of music. */
export interface Group {
  /** Everything ends up here; fading this silences the whole group. */
  out: GainNode;
  /** Tonal parts go through the sidechain pump first. */
  pump: GainNode;
  rev: GainNode;
  echo: GainNode;
}

export function midiHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function noiseSrc(a: AudioEngine, t: number, dur: number): AudioBufferSourceNode {
  const src = a.ctx!.createBufferSource();
  src.buffer = a.noise;
  src.loop = true;
  src.start(t, (t * 7.13) % 1.5);
  src.stop(t + dur + 0.02);
  return src;
}

export function kick(a: AudioEngine, g: Group, t: number, vel = 1): void {
  const ctx = a.ctx!;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(170, t);
  osc.frequency.exponentialRampToValueAtTime(46, t + 0.11);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.95 * vel, t + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
  osc.connect(amp).connect(g.out);
  osc.start(t);
  osc.stop(t + 0.36);
  // Transient click.
  const n = noiseSrc(a, t, 0.02);
  const nf = ctx.createBiquadFilter();
  nf.type = 'highpass';
  nf.frequency.value = 2500;
  const na = ctx.createGain();
  na.gain.setValueAtTime(0.25 * vel, t);
  na.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  n.connect(nf).connect(na).connect(g.out);
  // Sidechain: duck the tonal bus and let it swell back.
  g.pump.gain.cancelScheduledValues(t);
  g.pump.gain.setValueAtTime(0.42, t);
  g.pump.gain.linearRampToValueAtTime(1, t + 0.24);
}

export function snare(a: AudioEngine, g: Group, t: number, vel = 1): void {
  const ctx = a.ctx!;
  const n = noiseSrc(a, t, 0.2);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2100;
  f.Q.value = 0.8;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.5 * vel, t);
  amp.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  n.connect(f).connect(amp).connect(g.out);
  amp.connect(g.rev);
  const o = ctx.createOscillator();
  const oa = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(230, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  oa.gain.setValueAtTime(0.3 * vel, t);
  oa.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(oa).connect(g.out);
  o.start(t);
  o.stop(t + 0.12);
}

export function hat(a: AudioEngine, g: Group, t: number, vel = 1, open = false): void {
  const ctx = a.ctx!;
  const dur = open ? 0.2 : 0.04;
  const n = noiseSrc(a, t, dur);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = open ? 6500 : 8000;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.16 * vel, t);
  amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f).connect(amp).connect(g.out);
}

export function bass(a: AudioEngine, g: Group, t: number, hz: number, dur: number, vel = 1): void {
  const ctx = a.ctx!;
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'square';
  o1.frequency.value = hz;
  o2.frequency.value = hz / 2;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 5;
  f.frequency.setValueAtTime(1300, t);
  f.frequency.exponentialRampToValueAtTime(190, t + Math.min(0.2, dur));
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.34 * vel, t + 0.006);
  amp.gain.setValueAtTime(0.34 * vel, t + Math.max(0.01, dur - 0.03));
  amp.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.04);
  const sub = ctx.createGain();
  sub.gain.value = 0.6;
  o1.connect(f);
  o2.connect(sub).connect(f);
  f.connect(amp).connect(g.pump);
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.06); o2.stop(t + dur + 0.06);
}

export function lead(a: AudioEngine, g: Group, t: number, hz: number, dur: number, vel = 1, wave: OscillatorType = 'sawtooth'): void {
  const ctx = a.ctx!;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 2.5;
  f.frequency.setValueAtTime(4200, t);
  f.frequency.exponentialRampToValueAtTime(1500, t + Math.max(0.08, dur));
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.15 * vel, t + 0.008);
  amp.gain.setValueAtTime(0.13 * vel, t + Math.max(0.012, dur - 0.02));
  amp.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.09);
  for (const det of [-9, 9]) {
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = hz;
    o.detune.value = det;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.12);
  }
  f.connect(amp);
  amp.connect(g.pump);
  amp.connect(g.echo);
  amp.connect(g.rev);
}

export function pluck(a: AudioEngine, g: Group, t: number, hz: number, vel = 1): void {
  const ctx = a.ctx!;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = hz;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(3600, t);
  f.frequency.exponentialRampToValueAtTime(500, t + 0.14);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.085 * vel, t + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(f).connect(amp);
  amp.connect(g.pump);
  amp.connect(g.echo);
  o.start(t);
  o.stop(t + 0.22);
}

export function pad(a: AudioEngine, g: Group, t: number, freqs: number[], dur: number, vel = 1): void {
  const ctx = a.ctx!;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(700, t);
  f.frequency.linearRampToValueAtTime(1500, t + dur * 0.5);
  f.frequency.linearRampToValueAtTime(800, t + dur);
  const amp = ctx.createGain();
  const peak = 0.05 * vel;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + Math.min(0.35, dur * 0.3));
  amp.gain.setValueAtTime(peak, t + dur - 0.05);
  amp.gain.linearRampToValueAtTime(0.0001, t + dur + 0.45);
  for (const hz of freqs) {
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.5);
    }
  }
  f.connect(amp);
  amp.connect(g.pump);
  amp.connect(g.rev);
}

export function riser(a: AudioEngine, g: Group, t: number, dur: number): void {
  const ctx = a.ctx!;
  const n = noiseSrc(a, t, dur);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(7000, t + dur);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.22, t + dur);
  amp.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
  n.connect(f).connect(amp).connect(g.out);
  amp.connect(g.rev);
}

export function impact(a: AudioEngine, g: Group, t: number): void {
  const ctx = a.ctx!;
  const n = noiseSrc(a, t, 1.4);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(9000, t);
  f.frequency.exponentialRampToValueAtTime(400, t + 1.2);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.3, t);
  amp.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
  n.connect(f).connect(amp).connect(g.out);
  amp.connect(g.rev);
  const o = ctx.createOscillator();
  const oa = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(32, t + 0.7);
  oa.gain.setValueAtTime(0.6, t);
  oa.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  o.connect(oa).connect(g.out);
  o.start(t);
  o.stop(t + 0.85);
}
