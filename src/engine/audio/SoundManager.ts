/**
 * Procedural Web Audio Synthesizer & Music Engine for Rush Engine.
 * Zero external asset dependencies - generates all SFX and dynamic chiptune/synth music in real-time.
 */

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  isMuted: boolean;
}

export class SoundManager {
  private static instance: SoundManager | null = null;
  private ctx: AudioContext | null = null;

  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  public masterVolume: number = 0.8;
  public musicVolume: number = 0.5;
  public sfxVolume: number = 0.7;
  public isMuted: boolean = false;

  // Music state
  private isMusicPlaying: boolean = false;
  private musicInterval: number | null = null;
  private musicStep: number = 0;
  private musicBpm: number = 135;

  private constructor() {
    this.loadSettings();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * Initializes the Web Audio context on user gesture.
   */
  public async init(): Promise<void> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.updateGains();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private updateGains(): void {
    if (!this.masterGain || !this.musicGain || !this.sfxGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const m = this.isMuted ? 0 : this.masterVolume;
    this.masterGain.gain.setValueAtTime(m, now);
    this.musicGain.gain.setValueAtTime(this.musicVolume, now);
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, now);
  }

  public setMasterVolume(val: number): void {
    this.masterVolume = Math.max(0, Math.min(1, val));
    this.updateGains();
    this.saveSettings();
  }

  public setMusicVolume(val: number): void {
    this.musicVolume = Math.max(0, Math.min(1, val));
    this.updateGains();
    this.saveSettings();
  }

  public setSfxVolume(val: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    this.updateGains();
    this.saveSettings();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.updateGains();
    this.saveSettings();
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.updateGains();
    this.saveSettings();
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('rush_engine_audio');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.masterVolume === 'number') this.masterVolume = parsed.masterVolume;
        if (typeof parsed.musicVolume === 'number') this.musicVolume = parsed.musicVolume;
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = parsed.sfxVolume;
        if (typeof parsed.isMuted === 'boolean') this.isMuted = parsed.isMuted;
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(
        'rush_engine_audio',
        JSON.stringify({
          masterVolume: this.masterVolume,
          musicVolume: this.musicVolume,
          sfxVolume: this.sfxVolume,
          isMuted: this.isMuted,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }

  /* =========================================================================
   * SFX GENERATORS (Procedural Web Audio)
   * ========================================================================= */

  public playJump(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.12);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playLand(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playDeath(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;

    // 1. Noise burst
    const bufferSize = this.ctx.sampleRate * 0.18;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.18);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(now);

    // 2. Low-frequency punch
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playVictory(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5]; // C4 major arpeggio
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const startTime = now + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  /**
   * Tactile mechanical click for buttons and selectors with transient snap.
   */
  public playClick(pitchMult: number = 1.0): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;

    // 1. High-frequency micro transient (acoustic snap)
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(1400 * pitchMult, now);
    snapOsc.frequency.exponentialRampToValueAtTime(700 * pitchMult, now + 0.015);
    snapGain.gain.setValueAtTime(0.08, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
    snapOsc.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snapOsc.start(now);
    snapOsc.stop(now + 0.018);

    // 2. Resonant warm body
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(460 * pitchMult, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(820 * pitchMult, now + 0.035);
    bodyGain.gain.setValueAtTime(0.12, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.sfxGain);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.045);
  }

  private lastHoverTime: number = 0;

  /**
   * Ultra-subtle, crisp UI hover blip with pitch micro-variation and throttling.
   */
  public playHover(pitchMult: number = 1.0): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = performance.now();
    if (now - this.lastHoverTime < 25) return; // 25ms throttle
    this.lastHoverTime = now;

    this.ensureRunning();
    const audioNow = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1550 * pitchMult, audioNow);
    osc.frequency.exponentialRampToValueAtTime(1980 * pitchMult, audioNow + 0.016);

    gain.gain.setValueAtTime(0.038, audioNow);
    gain.gain.exponentialRampToValueAtTime(0.001, audioNow + 0.019);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(audioNow);
    osc.stop(audioNow + 0.021);
  }

  /**
   * Subtle descending navigation back tone.
   */
  public playBack(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.05);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Uplifting harmonic affirmative confirmation chime (triad arpeggio with shimmering decay).
   */
  public playConfirm(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chords.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.032;

      osc.type = idx === chords.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      const peakGain = idx === chords.length - 1 ? 0.15 : 0.09;
      gain.gain.setValueAtTime(peakGain, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (idx === chords.length - 1 ? 0.22 : 0.12));

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  /**
   * Interactive slider tick feedback modulated by position.
   */
  public playSliderTick(normalizedVal: number = 0.5): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freq = 600 + Math.max(0, Math.min(1, normalizedVal)) * 600;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.012);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.014);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.016);
  }

  /**
   * Low cyber warning buzz for invalid actions or locked selections.
   */
  public playError(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Shimmering chord arpeggio for equipping a new cosmetic chassis.
   */
  public playEquip(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    chords.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.035;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  /**
   * Toggle state switch acoustic feedback.
   */
  public playToggle(isOn: boolean): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    if (isOn) {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.04);
    } else {
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);
    }

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /* =========================================================================
   * PROCEDURAL DYNAMIC SYNTH MUSIC
   * ========================================================================= */

  public startMusic(): void {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.musicStep = 0;

    const stepTime = (60 / this.musicBpm) / 4; // 16th notes

    // Bassline and Arp pattern
    const bassline = [
      65.41, 65.41, 0, 65.41,   // C2
      77.78, 0, 77.78, 0,       // Eb2
      87.31, 87.31, 0, 87.31,   // F2
      98.00, 0, 87.31, 77.78,   // G2 - F2 - Eb2
    ];

    const leadArp = [
      261.63, 311.13, 392.00, 523.25,
      311.13, 392.00, 523.25, 622.25,
      349.23, 415.30, 523.25, 698.46,
      392.00, 523.25, 622.25, 783.99,
    ];

    this.musicInterval = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.isMuted || this.musicVolume <= 0 || !this.isMusicPlaying) {
        this.musicStep = (this.musicStep + 1) % 16;
        return;
      }

      this.ensureRunning();
      const now = this.ctx.currentTime;
      const stepIdx = this.musicStep % 16;

      // 1. Kick/Bass Pulse on quarter beats (0, 4, 8, 12)
      if (stepIdx % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.frequency.setValueAtTime(110, now);
        kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.09);
        kickGain.gain.setValueAtTime(0.24, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        kickOsc.connect(kickGain);
        kickGain.connect(this.musicGain);
        kickOsc.start(now);
        kickOsc.stop(now + 0.11);
      }

      // 2. Bassline Note
      const bassFreq = bassline[stepIdx];
      if (bassFreq > 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassFilter = this.ctx.createBiquadFilter();
        const bGain = this.ctx.createGain();

        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(320, now);

        bGain.gain.setValueAtTime(0.16, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.85);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bGain);
        bGain.connect(this.musicGain);

        bassOsc.start(now);
        bassOsc.stop(now + stepTime);
      }

      // 3. Arpeggiator Lead
      const arpFreq = leadArp[stepIdx];
      if (arpFreq) {
        const arpOsc = this.ctx.createOscillator();
        const arpGain = this.ctx.createGain();

        arpOsc.type = 'triangle';
        arpOsc.frequency.setValueAtTime(arpFreq, now);

        arpGain.gain.setValueAtTime(0.08, now);
        arpGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.7);

        arpOsc.connect(arpGain);
        arpGain.connect(this.musicGain);

        arpOsc.start(now);
        arpOsc.stop(now + stepTime);
      }

      // 4. Hi-hat on off-beats (2, 6, 10, 14)
      if (stepIdx % 2 === 0) {
        const hatBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.03, this.ctx.sampleRate);
        const hData = hatBuf.getChannelData(0);
        for (let i = 0; i < hData.length; i++) {
          hData[i] = Math.random() * 2 - 1;
        }
        const hat = this.ctx.createBufferSource();
        hat.buffer = hatBuf;

        const hFilter = this.ctx.createBiquadFilter();
        hFilter.type = 'highpass';
        hFilter.frequency.setValueAtTime(7000, now);

        const hGain = this.ctx.createGain();
        hGain.gain.setValueAtTime(stepIdx % 4 === 2 ? 0.08 : 0.04, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        hat.connect(hFilter);
        hFilter.connect(hGain);
        hGain.connect(this.musicGain);

        hat.start(now);
      }

      this.musicStep = (this.musicStep + 1) % 16;
    }, stepTime * 1000);
  }

  public stopMusic(): void {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.isMusicPlaying = false;
  }

  private ensureRunning(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public destroy(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
