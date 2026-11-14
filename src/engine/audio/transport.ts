import type { AudioEngine } from './engine.ts';
import type { MusicPlayer, Song } from './music.ts';

/**
 * The game's master clock. While audio is available, time is the position of
 * the music that is currently audible (audio clock minus output latency),
 * smoothed against performance.now() so it advances evenly between audio
 * callbacks. Without audio it falls back to a pure wall clock, so the game is
 * fully playable muted or on devices that refuse an AudioContext.
 */
export class Transport {
  private readonly audio: AudioEngine;
  private readonly music: MusicPlayer;
  /** perf-time (s) at which song time is zero. */
  private origin = 0;
  private usingAudio = false;
  private active = false;
  /** Smoothed (audio clock − perf clock). */
  private skew = NaN;
  private audioT0 = 0;
  private song: Song | null = null;

  constructor(audio: AudioEngine, music: MusicPlayer) {
    this.audio = audio;
    this.music = music;
  }

  get running(): boolean { return this.active; }

  /** Starts `song` so that position `offset` (s) is reached `delay` seconds from now. */
  start(song: Song, offset: number, delay: number): void {
    const perf = performance.now() / 1000;
    this.active = true;
    this.song = song;
    this.usingAudio = this.audio.running;
    this.origin = perf + delay - offset;
    if (this.usingAudio) {
      this.music.play(song, { offset, delay, loop: false });
      this.audioT0 = this.audio.now + delay - offset;
      this.skew = this.audio.now - perf;
    }
  }

  /**
   * Audio became available while the song was running silently on the wall
   * clock (the context was suspended when it started): bring the music in at
   * the current position.
   */
  resync(): void {
    if (!this.active || this.usingAudio || !this.song || !this.audio.running) return;
    const t = performance.now() / 1000 - this.origin;
    this.start(this.song, Math.max(0, t), Math.max(0, -t));
  }

  stop(fade = 0.06): void {
    if (!this.active) return;
    this.active = false;
    if (this.usingAudio) this.music.stop(fade);
  }

  /** Current song position in seconds (may be negative during a lead-in). */
  time(): number {
    return this.timeAt(performance.now() / 1000, true);
  }

  /** Song position for an arbitrary perf timestamp (used to place input edges). */
  timeAt(perf: number, update = false): number {
    if (!this.usingAudio) return perf - this.origin;
    if (update) {
      const a = this.audio.now;
      const now = performance.now() / 1000;
      const err = a - (now + this.skew);
      // The audio clock advances in blocks; follow it gently, snap on real jumps.
      if (!(Math.abs(err) < 0.08)) this.skew = a - now;
      else this.skew += err * 0.03;
    }
    return perf + this.skew - this.audioT0 - this.audio.latency;
  }
}
