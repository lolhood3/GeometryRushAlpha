import { AudioEngine } from '../engine/audio/engine.ts';
import { MusicPlayer, type Song } from '../engine/audio/music.ts';
import { Sfx } from '../engine/audio/sfx.ts';
import { Transport } from '../engine/audio/transport.ts';
import { pack, type RGB } from '../engine/gfx/color.ts';
import { Renderer, Shape, type BackgroundParams } from '../engine/gfx/renderer.ts';
import { Input, type InputEdge } from '../engine/input.ts';
import { FrameLoop } from '../engine/loop.ts';
import { damp } from '../engine/math.ts';
import { Particles } from '../engine/particles.ts';
import { getLevel, LEVEL_IDS } from './levels/index.ts';
import { REPLAYS } from './levels/replays.ts';
import { getSong } from './music/songs.ts';
import { isLevelUnlocked, syncRank, type Settings, type SyncRank } from './progression/profile.ts';
import type { ProfileStore, RunOutcome } from './progression/store.ts';
import { Camera } from './render/camera.ts';
import { Fx } from './render/fx.ts';
import { drawPlayer, resolveLook, TrailRibbon, type Look, type PlayerPose } from './render/player.ts';
import { ThemeTrack } from './render/theme.ts';
import { gateColor, orbColor, padColor, WorldRenderer, type WorldView } from './render/world.ts';
import { CELLS_PER_BEAT, Ev, Gate, HALF, Mode, TICK_RATE } from './sim/constants.ts';
import { xAtBeat, type Level } from './sim/level.ts';
import { Sim, type Snapshot } from './sim/sim.ts';

export type Phase = 'countdown' | 'running' | 'paused' | 'dead' | 'won' | 'results';

export interface RunResult {
  levelId: string;
  practice: boolean;
  attempts: number;
  syncRate: number;
  rank: SyncRank;
  shards: number;
  bestStreak: number;
  jumps: number;
  seconds: number;
  outcome: RunOutcome;
}

export interface Cue {
  id: number;
  text: string;
  sub: string;
}

/** Discrete state the UI renders from. Replaced (never mutated) on change. */
export interface GameState {
  mode: 'attract' | 'play';
  phase: Phase;
  levelId: string;
  practice: boolean;
  attempt: number;
  /** Shards held in the current run (bitmask). */
  shards: number;
  checkpoints: number;
  cue: Cue | null;
  /** 3, 2, 1 while resuming from pause; 0 otherwise. */
  countdown: number;
  deathPct: number;
  newBest: boolean;
  /** Waiting for a tap to retry (auto-retry disabled). */
  awaitRetry: boolean;
  result: RunResult | null;
  /** Session unlocks to celebrate (achievement ids). */
  audio: boolean;
}

/** Continuous values, updated in place every frame (read from a frame listener). */
export interface LiveState {
  progress: number;
  streak: number;
  syncRate: number;
  fps: number;
  pulse: number;
  beat: number;
  speed: number;
  instances: number;
  particles: number;
  resolution: string;
}

interface Checkpoint {
  snap: Snapshot;
  x: number;
  y: number;
  fails: number;
}

interface Attract {
  level: Level;
  sim: Sim;
  toggles: number[];
  idx: number;
  held: boolean;
  time: number;
  rest: number;
}

const WHITE: RGB = [1, 1, 1];
const LEAD_FIRST = 1.5;
const LEAD_RETRY = 0.6;
const RESUME_STEP = 0.5;
/** Most ticks simulated in one frame (0.3 s of game time). */
const MAX_CATCHUP = 72;
const QUALITY = {
  low: { dpr: 1, bg: 0, density: 0.4 },
  medium: { dpr: 1.5, bg: 1, density: 0.7 },
  high: { dpr: 2, bg: 1, density: 1 },
} as const;
const SCALES = [1, 0.85, 0.7, 0.58];

/**
 * Owns the whole runtime: renderer, audio, input, the active simulation and
 * its presentation. The UI talks to it through a handful of commands and
 * observes `state` (discrete) and `live` (per-frame).
 */
export class Game {
  readonly audio = new AudioEngine();
  readonly music = new MusicPlayer(this.audio);
  readonly sfx = new Sfx(this.audio);
  readonly input = new Input();
  readonly renderer: Renderer;
  readonly store: ProfileStore;

  state: GameState = {
    mode: 'attract', phase: 'running', levelId: LEVEL_IDS[0], practice: false, attempt: 0, shards: 0,
    checkpoints: 0, cue: null, countdown: 0, deathPct: 0, newBest: false, awaitRetry: false, result: null, audio: false,
  };
  readonly live: LiveState = {
    progress: 0, streak: 0, syncRate: 0, fps: 60, pulse: 0, beat: 0, speed: 1, instances: 0, particles: 0, resolution: '',
  };

  private readonly canvas: HTMLCanvasElement;
  private readonly loop: FrameLoop;
  private readonly transport: Transport;
  private readonly particles = new Particles();
  private readonly fx = new Fx(this.particles);
  private readonly world = new WorldRenderer();
  private readonly camera = new Camera();
  private readonly trail = new TrailRibbon();
  private readonly listeners = new Set<() => void>();
  private readonly frameListeners = new Set<() => void>();
  private readonly beatInfo = { pulse: 0, energy: 0.4 };
  private readonly bg: BackgroundParams = {
    time: 0, pulse: 0, energy: 0, horizon: 0, scroll: 0, quality: 1,
    sky0: [0, 0, 0], sky1: [0, 0, 0], acc: [0, 0, 0], acc2: [0, 0, 0],
  };
  private readonly pose: PlayerPose = { x: 0, y: HALF, rot: 0, mode: Mode.Cube, grav: 1, stretch: 1, alpha: 1, thrust: 0 };
  private readonly edges: InputEdge[] = [];
  private readonly pending: InputEdge[] = [];

  private settings: Settings;
  private look: Look;
  private attract: Attract;
  private theme: ThemeTrack;

  // Play session
  private level: Level;
  private sim: Sim;
  private song: Song;
  private checkpoints: Checkpoint[] = [];
  private cpLastBeat = 0;
  private cueIdx = 0;
  private cueId = 0;
  private timer = 0;
  private resuming = false;
  private runSeconds = 0;
  private base = { jumps: 0, orbs: 0, pads: 0, actions: 0, synced: 0 };
  private wonX = 0;

  // Presentation
  private time = 0;
  private flash = 0;
  private stretch = 1;
  private stretchV = 0;
  private playerAlpha = 1;
  private thrust = 0;
  private cssW = 1;
  private cssH = 1;
  private needsResize = true;
  private scaleIdx = 0;
  private slowFrames = 0;
  private dustAcc = 0;
  private moteAcc = 0;
  private fireAcc = 0;

  constructor(canvas: HTMLCanvasElement, store: ProfileStore) {
    this.canvas = canvas;
    this.store = store;
    this.renderer = new Renderer(canvas);
    this.transport = new Transport(this.audio, this.music);
    this.settings = store.profile.settings;
    this.look = resolveLook(store.profile.loadout);
    this.level = getLevel(LEVEL_IDS[0]);
    this.sim = new Sim(this.level);
    this.song = getSong(this.level.meta.song);
    this.attract = this.makeAttract(store.profile.lastLevel);
    this.theme = new ThemeTrack(this.attract.level);
    this.loop = new FrameLoop((dt) => this.frame(dt));
    this.input.attach('button, input, a, .overlay, .dialog-scrim');
    this.applySettings(this.settings);
    this.enterAttractView();

    store.subscribe(() => {
      const p = store.profile;
      if (p.settings !== this.settings) this.applySettings(p.settings);
      this.look = resolveLook(p.loadout);
    });
    new ResizeObserver(() => { this.needsResize = true; }).observe(canvas);
    window.addEventListener('resize', () => { this.needsResize = true; });
    this.audio.onStateChange = () => this.onAudioState();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state.mode === 'play') this.pause();
        this.audio.suspend();
      } else {
        this.audio.resume();
      }
    });
    window.addEventListener('blur', () => { if (this.state.mode === 'play') this.pause(); });
  }

  // ── Observation ──────────────────────────────────────────────────────────

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /** Called once per rendered frame, after `live` has been updated. */
  onFrame(fn: () => void): () => void {
    this.frameListeners.add(fn);
    return () => this.frameListeners.delete(fn);
  }

  private set(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    this.loop.start();
  }

  /** Must be called from a user gesture. Starts audio and the menu soundtrack. */
  async unlockAudio(): Promise<boolean> {
    const ok = await this.audio.unlock();
    this.onAudioState();
    return ok;
  }

  /**
   * The AudioContext started or stopped. Music that was requested while it
   * could not run is started now, so a late or repeated unlock never leaves
   * the game silent.
   */
  private onAudioState(): void {
    const ok = this.audio.running;
    const was = this.state.audio;
    if (ok) {
      this.applySettings(this.settings);
      if (this.state.mode === 'play') this.transport.resync();
      else if (!this.music.playing) this.playMenuMusic();
    } else if (was && this.state.mode === 'play') {
      // Audio was taken away mid-run (call, lock screen): hold the run instead of freezing it.
      this.pause();
    }
    if (ok !== was) this.set({ audio: ok });
  }

  playMenuMusic(): void {
    if (!this.audio.running) return;
    const menu = getSong('menu');
    if (this.music.song === menu) return;
    this.sfx.root = menu.root + 12;
    this.music.play(menu, { loop: true, fadeIn: 1.2, delay: 0.1 });
  }

  applySettings(s: Settings): void {
    this.settings = s;
    this.audio.offsetMs = s.audioOffsetMs;
    this.audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
    const q = this.qualityTier();
    this.particles.density = s.particles ? QUALITY[q].density : 0.15;
    if (s.quality !== 'auto') this.scaleIdx = 0;
    this.needsResize = true;
  }

  private qualityTier(): 'low' | 'medium' | 'high' {
    const q = this.settings.quality;
    if (q !== 'auto') return q;
    return this.scaleIdx >= 3 ? 'low' : this.scaleIdx >= 1 ? 'medium' : 'high';
  }

  // ── Attract mode (menu backdrop) ─────────────────────────────────────────

  private makeAttract(id: string): Attract {
    const level = getLevel(REPLAYS[id] ? id : LEVEL_IDS[0]);
    const sim = new Sim(level);
    sim.emit = true;
    return { level, sim, toggles: REPLAYS[level.meta.id], idx: 0, held: false, time: 0, rest: 0 };
  }

  /** Chooses which level the autopilot demonstrates behind the menus. */
  setAttractLevel(id: string): void {
    if (this.attract.level.meta.id === id) return;
    this.attract = this.makeAttract(id);
    if (this.state.mode === 'attract') this.enterAttractView();
  }

  private enterAttractView(): void {
    this.theme = new ThemeTrack(this.attract.level);
    this.trail.reset();
    this.particles.clear();
    this.playerAlpha = 1;
    this.flash = 0;
    this.camera.zoomTarget = 1;
    this.camera.backdrop = true;
    this.camera.follow(this.attract.sim.x, this.attract.sim.y, 0, true);
  }

  private updateAttract(dt: number): void {
    const a = this.attract;
    const s = a.sim;
    if (s.dead || s.won) {
      a.rest += dt;
      if (a.rest > 1.4) {
        // Tour the levels the player has opened.
        const open = LEVEL_IDS.filter((id) => isLevelUnlocked(this.store.profile, id));
        const next = s.won && open.length > 1
          ? open[(open.indexOf(a.level.meta.id as (typeof LEVEL_IDS)[number]) + 1) % open.length]
          : a.level.meta.id;
        this.attract = this.makeAttract(next);
        this.enterAttractView();
      }
      return;
    }
    a.time += dt;
    let target = Math.floor(a.time * TICK_RATE);
    if (target - s.tick > 60) { target = s.tick + 60; a.time = target / TICK_RATE; }
    while (s.tick < target && !s.dead && !s.won) {
      while (a.idx < a.toggles.length && a.toggles[a.idx] <= s.tick) { a.held = !a.held; a.idx++; }
      s.setInput(a.held);
      s.step();
      this.trail.push(s.x, s.y);
    }
    this.handleEvents(s, false);
    if (s.won) this.wonX = s.x;
  }

  // ── Play session ─────────────────────────────────────────────────────────

  startLevel(id: string, practice: boolean): void {
    const level = getLevel(id);
    this.level = level;
    this.sim = new Sim(level);
    this.sim.emit = true;
    this.song = getSong(level.meta.song);
    this.theme = new ThemeTrack(level);
    this.sfx.root = this.song.root + 12;
    this.music.stop(0.25);
    this.store.setLastLevel(id);
    this.set({
      mode: 'play', levelId: id, practice, attempt: 0, shards: 0, checkpoints: 0, cue: null,
      countdown: 0, deathPct: 0, newBest: false, awaitRetry: false, result: null,
    });
    this.checkpoints = [];
    this.particles.clear();
    this.camera.backdrop = false;
    this.input.setEnabled(true);
    this.beginAttempt(LEAD_FIRST);
  }

  private beginAttempt(lead: number): void {
    const s = this.sim;
    const cp = this.state.practice ? this.checkpoints[this.checkpoints.length - 1] : undefined;
    if (cp) s.load(cp.snap); else { s.reset(); this.checkpoints.length = 0; }
    this.cpLastBeat = s.beat;
    this.base = { jumps: s.jumps, orbs: s.orbs, pads: s.pads, actions: s.actions, synced: s.synced };
    this.runSeconds = 0;
    this.pending.length = 0;
    this.input.drain(this.edges);
    s.setInput(this.input.held);
    this.resuming = false;
    this.trail.reset();
    this.playerAlpha = 1;
    this.stretch = 1;
    this.stretchV = 0;
    this.syncCues(s.beat);
    this.camera.zoomTarget = this.zoomAt(s.beat);
    this.camera.follow(s.tick === 0 ? xAtBeat(this.level, -lead / this.level.beatDur) : s.x, s.y, 0, true);
    this.store.beginAttempt(this.level.meta.id, this.state.practice);
    this.transport.start(this.song, s.tick / TICK_RATE, lead);
    this.set({
      phase: 'countdown', attempt: this.state.attempt + 1, shards: s.shards, countdown: 0,
      awaitRetry: false, newBest: false, checkpoints: this.checkpoints.length, cue: null,
    });
  }

  private zoomAt(beat: number): number {
    let z = 1;
    for (const t of this.level.triggers) if (t.kind === 'zoom' && t.beat <= beat) z = t.zoom;
    return z;
  }

  private syncCues(beat: number): void {
    const tr = this.level.triggers;
    let i = 0;
    while (i < tr.length && tr[i].beat <= beat) i++;
    this.cueIdx = i;
  }

  private runTriggers(beat: number): void {
    const tr = this.level.triggers;
    while (this.cueIdx < tr.length && tr[this.cueIdx].beat <= beat) {
      const t = tr[this.cueIdx++];
      if (t.kind === 'text') this.set({ cue: { id: ++this.cueId, text: t.text, sub: t.sub } });
      else if (t.kind === 'zoom') this.camera.zoomTarget = t.zoom;
      else if (t.kind === 'flash' && this.settings.flashes && !this.settings.reducedMotion) this.flash = Math.max(this.flash, 0.6);
    }
  }

  private updatePlay(dt: number): void {
    const st = this.state;
    const s = this.sim;
    switch (st.phase) {
      case 'paused':
      case 'results':
        return;
      case 'dead':
        this.timer -= dt;
        if (this.timer > 0) return;
        if (this.settings.autoRetry || st.practice) { this.beginAttempt(LEAD_RETRY); return; }
        if (!st.awaitRetry) { this.set({ awaitRetry: true }); this.input.drain(this.edges); return; }
        this.input.drain(this.edges);
        if (this.edges.some((e) => e.down)) this.beginAttempt(LEAD_RETRY);
        return;
      case 'won':
        this.timer += dt;
        if (this.timer > 1.9) this.finishRun();
        return;
    }

    const t = this.transport.time();

    if (st.phase === 'countdown') {
      if (this.resuming) {
        const n = Math.max(0, Math.ceil((s.tick / TICK_RATE - t) / RESUME_STEP));
        if (n !== st.countdown) {
          if (n > 0) this.sfx.play('tick');
          this.set({ countdown: n });
        }
      }
      if (t * TICK_RATE >= s.tick + 1) {
        this.resuming = false;
        this.set({ phase: 'running', countdown: 0 });
      }
    }

    // A long hitch must never fast-forward the player blind. Long stalls pause;
    // shorter ones advance a bounded amount and pull the music back to the sim.
    let target = Math.floor(t * TICK_RATE);
    let resync = false;
    if (target - s.tick > MAX_CATCHUP * 8) { this.pause(); return; }
    if (target - s.tick > MAX_CATCHUP) { target = s.tick + MAX_CATCHUP; resync = true; }

    this.input.drain(this.edges);
    for (const e of this.edges) this.pending.push(e);
    let ei = 0;
    const pend = this.pending;
    while (s.tick < target && !s.dead && !s.won) {
      const next = s.tick + 1;
      while (ei < pend.length && Math.ceil(this.transport.timeAt(pend[ei].time) * TICK_RATE) <= next) {
        const down = pend[ei++].down;
        s.setInput(down);
        // A press always lasts at least one tick, so a tap shorter than a
        // tick (or a press and release delivered together) still registers.
        if (down) break;
      }
      s.step();
      this.trail.push(s.x, s.y);
    }
    if (ei > 0) pend.splice(0, ei);
    if (resync && !s.dead && !s.won) this.transport.start(this.song, s.tick / TICK_RATE, 0);

    if (this.state.phase === 'running') this.runSeconds += dt;
    this.handleEvents(s, true);
    this.runTriggers(s.beat);

    if (s.dead) { this.onDeath(); return; }
    if (s.won) { this.onWin(); return; }
    if (st.practice) this.maybeCheckpoint();
  }

  private maybeCheckpoint(): void {
    const s = this.sim;
    const beat = s.beat;
    if (beat - this.cpLastBeat < 4 || beat > this.level.endBeat - 2) return;
    const safe = s.mode === Mode.Cube ? s.grounded : Math.abs(s.vy) < 2.5 && beat - this.cpLastBeat >= 6;
    if (!safe) return;
    this.cpLastBeat = beat;
    this.checkpoints.push({ snap: s.save(), x: s.x, y: s.y, fails: 0 });
    this.fx.ring(s.x, s.y, [0.4, 1, 0.6], 0.4, 3, 0.4);
    this.sfx.play('checkpoint');
    this.set({ checkpoints: this.checkpoints.length });
  }

  /** Practice mode: discard the most recent checkpoint. */
  removeCheckpoint(): void {
    if (!this.state.practice || this.checkpoints.length === 0) return;
    this.checkpoints.pop();
    this.cpLastBeat = this.sim.beat;
    this.sfx.play('back');
    this.set({ checkpoints: this.checkpoints.length });
  }

  private report(completed: boolean, died: boolean): RunOutcome {
    const s = this.sim;
    const b = this.base;
    return this.store.recordRun({
      levelId: this.level.meta.id, practice: this.state.practice, completed, died,
      progress: s.progress, seconds: this.runSeconds,
      jumps: s.jumps - b.jumps, orbs: s.orbs - b.orbs, pads: s.pads - b.pads,
      actions: s.actions - b.actions, synced: s.synced - b.synced,
      bestStreak: s.bestStreak, shards: s.shards, sessionAttempts: this.state.attempt,
    });
  }

  private onDeath(): void {
    const s = this.sim;
    this.transport.stop(0.05);
    this.sfx.play('death');
    if (this.settings.shake && !this.settings.reducedMotion) this.camera.shake(0.42);
    if (this.settings.flashes && !this.settings.reducedMotion) this.flash = Math.max(this.flash, 0.45);
    if (this.settings.haptics && navigator.vibrate) navigator.vibrate(40);
    this.playerAlpha = 0;

    // A checkpoint that kills the player straight away is a bad checkpoint.
    const cp = this.checkpoints[this.checkpoints.length - 1];
    if (this.state.practice && cp && s.tick - cp.snap.tick < 0.75 / s.dB) {
      if (++cp.fails >= 2) this.checkpoints.pop();
    }
    const outcome = this.report(false, true);
    this.timer = this.state.practice ? 0.6 : 0.9;
    this.set({
      phase: 'dead', deathPct: Math.min(99, Math.floor(s.progress * 100)),
      newBest: outcome.newBest && !this.state.practice && s.progress > 0.02, checkpoints: this.checkpoints.length,
    });
  }

  private onWin(): void {
    this.timer = 0;
    this.wonX = this.sim.x;
    this.sfx.play('win');
    if (this.settings.flashes && !this.settings.reducedMotion) this.flash = 0.7;
    if (this.settings.haptics && navigator.vibrate) navigator.vibrate([30, 40, 60]);
    this.input.setEnabled(false);
    this.set({ phase: 'won', cue: null });
  }

  private finishRun(): void {
    const s = this.sim;
    const actions = s.actions;
    const rate = actions > 0 ? s.synced / actions : 0;
    const outcome = this.report(true, false);
    this.set({
      phase: 'results',
      result: {
        levelId: this.level.meta.id, practice: this.state.practice, attempts: this.state.attempt,
        syncRate: rate, rank: syncRank(rate), shards: s.shards, bestStreak: s.bestStreak, jumps: s.jumps,
        seconds: this.level.endBeat * this.level.beatDur, outcome,
      },
    });
  }

  pause(): void {
    const ph = this.state.phase;
    if (this.state.mode !== 'play' || (ph !== 'running' && ph !== 'countdown' && ph !== 'dead')) return;
    this.transport.stop(0.05);
    this.input.setEnabled(false);
    this.pending.length = 0;
    this.set({ phase: 'paused', countdown: 0 });
  }

  resume(): void {
    if (this.state.mode !== 'play' || this.state.phase !== 'paused') return;
    const s = this.sim;
    this.input.setEnabled(true);
    // Paused on the crash screen: resuming simply starts the next attempt.
    if (s.dead) { this.beginAttempt(LEAD_RETRY); return; }
    s.setInput(false);
    if (s.tick === 0) {
      this.transport.start(this.song, 0, LEAD_RETRY);
      this.set({ phase: 'countdown', countdown: 0 });
      return;
    }
    this.resuming = true;
    this.transport.start(this.song, s.tick / TICK_RATE, RESUME_STEP * 3);
    this.sfx.play('tick');
    this.set({ phase: 'countdown', countdown: 3 });
  }

  /** Restarts the level from the beginning, optionally switching mode. */
  restart(practice = this.state.practice): void {
    if (this.state.mode !== 'play') return;
    this.abandon();
    this.checkpoints.length = 0;
    this.input.setEnabled(true);
    this.set({ practice, result: null, checkpoints: 0 });
    this.beginAttempt(LEAD_RETRY);
  }

  /** Records a run that is being left unfinished. */
  private abandon(): void {
    const ph = this.state.phase;
    this.transport.stop(0.08);
    if ((ph === 'running' || ph === 'paused' || ph === 'countdown') && this.sim.tick > 0 && !this.sim.dead && !this.sim.won) {
      this.report(false, false);
    }
  }

  /** Leaves the level and returns to the menu backdrop. */
  exitLevel(): void {
    if (this.state.mode !== 'play') return;
    this.abandon();
    this.music.stop(0.2);
    this.input.setEnabled(false);
    this.attract = this.makeAttract(this.level.meta.id);
    this.set({ mode: 'attract', phase: 'running', cue: null, result: null, countdown: 0, awaitRetry: false });
    this.enterAttractView();
    this.playMenuMusic();
  }

  // ── Events → feedback ────────────────────────────────────────────────────

  private handleEvents(s: Sim, audible: boolean): void {
    const ev = s.events;
    if (ev.length === 0) return;
    const look = this.look;
    const pal = this.theme.current;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      switch (e.type) {
        case Ev.Jump:
          this.fx.jump(e.x, e.y, s.grav, e.a ? WHITE : look.primary, e.a === 1);
          this.kick(0.16);
          if (audible) this.sfx.play(e.a ? 'sync' : 'jump', s.streak);
          break;
        case Ev.Land:
          this.fx.land(e.x, e.y, s.grav, look.primary, Math.min(1, e.a / 160));
          this.kick(-0.2);
          if (audible && e.a > 60) this.sfx.play('land');
          break;
        case Ev.Orb: {
          const sub = e.a & 15;
          const c = orbColor(sub);
          this.fx.ring(e.x, e.y, c, 0.6, 3.4, 0.36);
          this.fx.burst(e.x, e.y, c, 8, 6);
          if (e.a & 16) this.fx.ring(e.x, e.y, WHITE, 0.5, 2.6, 0.28);
          this.kick(0.16);
          if (audible) this.sfx.play(sub === 1 ? 'orbGravity' : 'orb');
          break;
        }
        case Ev.Pad: {
          const c = padColor(e.a);
          this.fx.ring(e.x, e.y, c, 0.5, 3.4, 0.36);
          this.fx.burst(e.x, e.y - 0.3 * s.grav, c, 10, 8);
          this.kick(0.22);
          if (audible) this.sfx.play(e.a === 1 ? 'padGravity' : 'pad');
          break;
        }
        case Ev.Gate: {
          this.fx.gate(e.x, e.y, gateColor(e.a, 0));
          if (audible) this.sfx.play('gate');
          if (e.a <= Gate.Wave) this.trail.reset();
          break;
        }
        case Ev.Speed:
          this.fx.gate(e.x, e.y, gateColor(Gate.Speed, e.a));
          if (audible) this.sfx.play(e.a > 1 ? 'speedUp' : 'speedDown');
          break;
        case Ev.Shard:
          this.fx.pickup(e.x, e.y, pal.accent2);
          if (audible) {
            this.sfx.play('shard');
            this.set({ shards: s.shards });
          }
          break;
        case Ev.Death:
          this.fx.death(e.x, e.y, look.primary, look.secondary);
          if (!audible) this.playerAlpha = 0;
          break;
        case Ev.Win:
          for (let k = 0; k < 4; k++) {
            this.fx.firework(e.x + 1 + k * 1.6, 2.5 + (k % 2) * 2.5 + Math.random() * 1.5, k % 2 ? pal.accent2 : pal.accent);
          }
          break;
      }
    }
    ev.length = 0;
  }

  /** Squash-and-stretch impulse (positive stretches vertically). */
  private kick(v: number): void {
    if (this.settings.reducedMotion) return;
    this.stretch = 1 + v;
    this.stretchV = 0;
  }

  // ── Frame ────────────────────────────────────────────────────────────────

  private frame(dt: number): void {
    if (this.renderer.lost) return;
    this.time += dt;
    if (this.needsResize) this.resize();
    this.input.poll();

    const play = this.state.mode === 'play';
    if (play) this.updatePlay(dt); else this.updateAttract(dt);

    const frozen = play && this.state.phase === 'paused';
    if (play && (this.state.phase === 'won' || this.state.phase === 'results')) this.celebrate(dt);
    const s = play ? this.sim : this.attract.sim;
    const L = s.level;

    // Beat-synchronous drivers.
    let beat = s.beat;
    if (play) {
      const t = this.transport.running ? this.transport.time() : s.tick / TICK_RATE;
      beat = t / L.beatDur;
      this.music.analyse(this.song, t, this.beatInfo);
      if (!this.transport.running && this.state.phase !== 'won') this.beatInfo.pulse = 0;
    } else {
      const mt = this.music.songTime();
      if (Number.isNaN(mt) || !this.music.song) {
        const phase = (this.time * 104) / 60;
        this.beatInfo.pulse = Math.exp(-(phase - Math.floor(phase)) * 3.2) * 0.8;
        this.beatInfo.energy = 0.4;
      } else {
        this.music.analyse(this.music.song, mt, this.beatInfo);
      }
    }
    const pulse = this.settings.reducedMotion ? this.beatInfo.pulse * 0.25 : this.beatInfo.pulse;

    // Player pose.
    const pose = this.pose;
    const running = play ? this.state.phase === 'running' || this.state.phase === 'countdown' : !s.dead && !s.won;
    if (play && s.tick === 0 && this.state.phase !== 'paused') {
      pose.x = xAtBeat(L, Math.min(0, beat));
      pose.y = HALF;
      pose.rot = 0;
    } else if (s.won) {
      const since = play ? this.timer : this.attract.rest;
      pose.x = this.wonX + since * CELLS_PER_BEAT * s.speed / L.beatDur;
      pose.y = s.y;
      pose.rot = s.rot;
      this.playerAlpha = Math.max(0, 1 - since * 2.2);
    } else if (running && !s.dead && play && this.state.phase === 'running') {
      const f = this.transport.time() * TICK_RATE - s.tick;
      const k = f < 0 ? 0 : f > 1 ? 1 : f;
      pose.x = s.x + (s.x - s.px) * k;
      pose.y = s.y + (s.y - s.py) * k;
      pose.rot = s.rot + (s.rot - s.prot) * k;
    } else {
      pose.x = s.x; pose.y = s.y; pose.rot = s.rot;
    }
    pose.mode = s.mode;
    pose.grav = s.grav;

    if (!frozen) {
      // Squash & stretch spring.
      for (let left = dt; left > 0; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        this.stretchV += ((1 - this.stretch) * 320 - this.stretchV * 22) * h;
        this.stretch += this.stretchV * h;
      }
      this.thrust = damp(this.thrust, s.mode === Mode.Ship && s.held ? 1 : 0, 14, dt);
      this.flash = Math.max(0, this.flash - dt * 2.4);
      this.ambient(s, pose, dt, running && !s.dead);
      this.particles.update(dt);
      this.camera.follow(s.won ? this.wonX : pose.x, pose.y, dt);
      if (!s.dead && this.playerAlpha > 0) this.trail.push(pose.x, pose.y);
    }
    pose.stretch = s.mode === Mode.Cube ? Math.max(0.6, Math.min(1.35, this.stretch)) : 1;
    pose.alpha = this.playerAlpha;
    pose.thrust = this.thrust;

    this.render(s, beat, pulse);

    const lv = this.live;
    lv.progress = s.progress;
    lv.streak = s.streak;
    lv.syncRate = s.actions > 0 ? s.synced / s.actions : 0;
    lv.fps = this.loop.fps;
    lv.pulse = pulse;
    lv.beat = beat;
    lv.speed = s.speed;
    lv.instances = this.renderer.lastInstances;
    lv.particles = this.particles.count;
    for (const fn of this.frameListeners) fn();
    this.govern();
  }

  private celebrate(dt: number): void {
    this.fireAcc += dt;
    if (this.fireAcc < 0.55) return;
    this.fireAcc = 0;
    const cam = this.camera;
    const pal = this.theme.current;
    this.fx.firework(cam.left + Math.random() * cam.viewW, cam.y + (Math.random() - 0.2) * cam.viewH * 0.4,
      Math.random() < 0.5 ? pal.accent : pal.accent2);
  }

  private ambient(s: Sim, pose: PlayerPose, dt: number, moving: boolean): void {
    const cam = this.camera;
    const pal = this.theme.current;
    const density = this.particles.density;
    this.moteAcc += dt * 7 * density;
    while (this.moteAcc > 1) {
      this.moteAcc -= 1;
      this.fx.mote(cam.right + Math.random() * 3, 0.4 + Math.random() * (cam.viewH * 0.8), pal.accent2);
    }
    if (!moving) return;
    const vx = (CELLS_PER_BEAT * s.speed) / s.level.beatDur;
    if (s.speed > 1.05 && Math.random() < dt * 22 * (s.speed - 1) * density) {
      this.fx.speedLine(cam.right + 1, cam.y - cam.viewH / 2 + Math.random() * cam.viewH, WHITE, s.speed);
    }
    if (s.mode === Mode.Cube && s.grounded) {
      this.dustAcc += dt * 34;
      while (this.dustAcc > 1) { this.dustAcc -= 1; this.fx.dust(pose.x, pose.y, s.grav, this.look.primary, vx); }
    } else if (s.mode === Mode.Ship && s.held) {
      this.fx.thrust(pose.x - 0.7, pose.y - 0.1 * s.grav, this.look.secondary, vx, s.vy);
    }
    if (this.look.trail.sparks && Math.random() < dt * 40) this.fx.spark(pose.x - 0.4, pose.y, this.look.primary);
  }

  private render(s: Sim, beat: number, pulse: number): void {
    const r = this.renderer;
    const cam = this.camera;
    const pal = this.theme.at(beat);
    const tier = this.qualityTier();
    r.begin();

    const bg = this.bg;
    bg.time = this.time;
    bg.pulse = pulse;
    bg.energy = this.beatInfo.energy;
    bg.horizon = cam.horizonPx;
    bg.scroll = cam.x * cam.scale;
    bg.quality = QUALITY[tier].bg;
    bg.sky0 = pal.sky0; bg.sky1 = pal.sky1; bg.acc = pal.accent; bg.acc2 = pal.accent2;
    r.background(bg);

    r.setCamera(cam.x + cam.shakeX, cam.y + cam.shakeY, cam.scale);
    const view: WorldView = {
      level: s.level, used: s.used, beat, time: this.time, pulse,
      left: cam.left, right: cam.right, palette: pal,
    };
    this.world.draw(r, view);

    if (this.state.mode === 'play' && this.state.practice) {
      const green = pack([0.4, 1, 0.6]);
      for (const cp of this.checkpoints) {
        if (cp.x < cam.left - 1 || cp.x > cam.right + 1) continue;
        r.shape(Shape.Box, cp.x, cp.y, 0.2, 0.2, Math.PI / 4, pack([0.4, 1, 0.6], 0.25), green, 0.05, 0.4, 0.5, 0.02);
      }
    }

    this.trail.draw(r, this.look, s.mode, pulse, this.pose.alpha);
    this.particles.draw(r, cam.left - 2, cam.right + 4);
    drawPlayer(r, this.look, this.pose, pulse);

    if (this.flash > 0.01) {
      r.setCamera(0, 0, 1);
      r.shape(Shape.Box, 0, 0, r.width, r.height, 0, pack(WHITE, this.flash * 0.32), 0);
    }
    r.end();
  }

  private resize(): void {
    this.needsResize = false;
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    const tier = this.qualityTier();
    const cap = this.settings.quality === 'auto' ? 2 : QUALITY[tier].dpr;
    const ratio = Math.min(window.devicePixelRatio || 1, cap) * (this.settings.quality === 'auto' ? SCALES[this.scaleIdx] : 1);
    this.renderer.resize(this.cssW, this.cssH, Math.max(0.5, ratio));
    this.camera.layout(this.renderer.width, this.renderer.height);
    this.live.resolution = `${this.renderer.width}×${this.renderer.height}`;
  }

  /** Auto quality: step the render resolution down when frames run long. */
  private govern(): void {
    if (this.settings.quality !== 'auto') return;
    const ms = this.loop.frameMs;
    if (ms > 21 && this.scaleIdx < SCALES.length - 1) {
      if (++this.slowFrames > 90) {
        this.slowFrames = 0;
        this.scaleIdx++;
        this.particles.density = this.settings.particles ? QUALITY[this.qualityTier()].density : 0.15;
        this.needsResize = true;
      }
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 2);
    }
  }
}
