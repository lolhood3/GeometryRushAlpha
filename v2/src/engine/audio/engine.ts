export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

/**
 * Owns the AudioContext and the mixing graph.
 *
 *   instruments ─┬─► pump ─┐
 *     (drums) ───┴─────────┴─► musicIn ─► musicFilter ─► music ─┐
 *     reverb / delay sends ─────────────► musicFilter           ├─► master ─► limiter ─► out
 *   sound effects ─────────────────────────────────────► sfx ───┘
 *
 * Every sound in the game goes through one of the two buses, so volume
 * settings, muffling (pause / death) and limiting stay consistent.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  musicIn!: GainNode;
  musicFilter!: BiquadFilterNode;
  reverbIn!: GainNode;
  delayIn!: GainNode;
  delay!: DelayNode;
  noise!: AudioBuffer;

  /** User calibration added on top of the reported output latency (ms). */
  offsetMs = 0;
  private vol: Volumes = { master: 0.8, music: 0.8, sfx: 0.8, muted: false };

  get running(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Seconds between scheduling a sound and hearing it. */
  get latency(): number {
    const c = this.ctx;
    if (!c) return 0;
    const reported = (c as AudioContext & { outputLatency?: number }).outputLatency;
    const base = typeof reported === 'number' && reported > 0 && reported < 0.5 ? reported : c.baseLatency || 0;
    return base + this.offsetMs / 1000;
  }

  /** Creates (first call) and resumes the context. Must run inside a user gesture. */
  async unlock(): Promise<boolean> {
    try {
      if (!this.ctx) this.build();
      if (this.ctx!.state !== 'running') await this.ctx!.resume();
    } catch {
      return false;
    }
    return this.running;
  }

  private build(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(limiter);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 20000;
    this.musicFilter.Q.value = 0.7;
    this.musicFilter.connect(this.music);
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.musicFilter);

    // Shared white-noise source for drums, risers and impacts.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = this.noise.getChannelData(0);
    let seed = 0x2f6e2b1;
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      ch[i] = (seed >>> 8) / 8388608 - 1;
    }

    // Small synthetic room: decaying noise impulse.
    const irLen = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        const t = i / irLen;
        d[i] = ((seed >>> 8) / 8388608 - 1) * Math.pow(1 - t, 3.2) * (i < 400 ? i / 400 : 1);
      }
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = ir;
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.5;
    this.reverbIn = ctx.createGain();
    this.reverbIn.connect(reverb);
    reverb.connect(reverbOut);
    reverbOut.connect(this.musicFilter);

    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.3;
    const fb = ctx.createGain();
    fb.gain.value = 0.36;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3200;
    this.delayIn = ctx.createGain();
    this.delayIn.connect(this.delay);
    this.delay.connect(damp);
    damp.connect(fb);
    fb.connect(this.delay);
    damp.connect(this.musicFilter);

    this.applyVolumes(0);
  }

  setVolumes(v: Volumes): void {
    this.vol = { ...v };
    this.applyVolumes(0.04);
  }

  private applyVolumes(ramp: number): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const set = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(t);
      if (ramp > 0) p.setTargetAtTime(v, t, ramp); else p.setValueAtTime(v, t);
    };
    // Perceptual (squared) taper so the sliders feel linear.
    set(this.master.gain, this.vol.muted ? 0 : this.vol.master * this.vol.master);
    set(this.music.gain, this.vol.music * this.vol.music * 0.9);
    set(this.sfx.gain, this.vol.sfx * this.vol.sfx);
  }

  /** 0 = clear, 1 = heavily muffled (pause menu, death). */
  muffle(amount: number, time = 0.12): void {
    const c = this.ctx;
    if (!c) return;
    const f = 20000 * Math.pow(0.02, amount);
    this.musicFilter.frequency.cancelScheduledValues(c.currentTime);
    this.musicFilter.frequency.setTargetAtTime(f, c.currentTime, Math.max(0.01, time / 3));
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }
}
