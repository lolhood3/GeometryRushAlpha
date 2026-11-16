import { AudioEngine } from '../engine/audio/engine.ts';
import { MusicPlayer, type Song } from '../engine/audio/music.ts';
import { Sfx } from '../engine/audio/sfx.ts';
import { Transport } from '../engine/audio/transport.ts';
import { pack, type RGB } from '../engine/gfx/color.ts';
import { Renderer, Shape, type BackgroundParams } from '../engine/gfx/renderer.ts';
import { Input, type InputEdge } from '../engine/input.ts';
import { RenderBudget } from '../engine/budget.ts';
import { FrameLoop } from '../engine/loop.ts';
import { damp } from '../engine/math.ts';
import { Particles } from '../engine/particles.ts';
import { referenceReplay, refreshDaily } from './levels/daily.ts';
import { DAILY_ID, getLevel, LEVEL_IDS } from './levels/index.ts';
import { previewWindow, routeOf, sectionStart, type Cursor } from './levels/route.ts';
import { getSong } from './music/songs.ts';
import { INTRO_AGAIN, INTRO_DONE, INTRO_LEVEL, IntroTracker, introWanted, type IntroView } from './onboarding.ts';
import { isLevelUnlocked, syncRank, type Settings, type SyncRank } from './progression/profile.ts';
import { levelSignature, MAX_GHOST_TOGGLES, type Ghost } from './progression/ghosts.ts';
import { encodeRun, runRef, runSignature, type RunCheck } from './replay/code.ts';
import { daily } from './levels/daily.ts';
import type { ProfileStore, RunOutcome } from './progression/store.ts';
import { Camera } from './render/camera.ts';
import { Fx } from './render/fx.ts';
import { drawPlayer, resolveLook, TrailRibbon, type Look, type PlayerPose } from './render/player.ts';
import { ThemeTrack } from './render/theme.ts';
import { gateColor, orbColor, padColor, WorldRenderer, type WorldView } from './render/world.ts';
import { CELLS_PER_BEAT, Ev, Gate, HALF, MINI_HALF, Mode, TICK_RATE } from './sim/constants.ts';
import { xAtBeat, type Level } from './sim/level.ts';
import { Sim, type Snapshot } from './sim/sim.ts';

/** `replay` is the best run being played back from the results screen: nobody is at the controls and nothing is recorded. */
export type Phase = 'countdown' | 'running' | 'paused' | 'dead' | 'won' | 'results' | 'replay';

export interface RunResult {
  levelId: string;
  practice: boolean;
  /** Part of the route the run started from; 0 for a run from the start. */
  section: number;
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
  /** Where the practice checkpoints are along the track, 0..1, oldest first. */
  marks: number[];
  /** Part of the route a practice run was started from; 0 when it began at the start. */
  section: number;
  cue: Cue | null;
  /** The guided intro, while it is running. */
  coach: IntroView | null;
  /** 3, 2, 1 while resuming from pause; 0 otherwise. */
  countdown: number;
  deathPct: number;
  /** Where the last crash of this visit happened, 0..1, or -1 before the first one. */
  lastDeath: number;
  /** The best on record before the attempt that just ended, in percent. */
  bestBefore: number;
  newBest: boolean;
  /** Waiting for a tap to retry (auto-retry disabled). */
  awaitRetry: boolean;
  /** Racing a run that was loaded from a code. */
  rival: boolean;
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
  /** Share of the full particle and effect load the frame rate currently affords, 0.25 to 1. */
  effects: number;
  resolution: string;
  /** The last jump or orb: `seq` counts them, `off` is the distance from the beat grid in beats (negative is early). */
  timing: { seq: number; off: number; hit: boolean };
  /** True while a run loaded from a code is on the track as an outline. */
  ghost: boolean;
}

/** The stored best run, being played back beside the player. */
interface GhostRun {
  data: Ghost;
  sim: Sim;
  idx: number;
  held: boolean;
  alpha: number;
  done: boolean;
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
/** A run that starts part-way through gets a longer count-in to read the scene. */
const LEAD_SECTION = 1.2;
const RESUME_STEP = 0.5;
/** Most ticks simulated in one frame (0.3 s of game time). */
const MAX_CATCHUP = 72;
const QUALITY = {
  low: { dpr: 1, bg: 0, density: 0.4 },
  medium: { dpr: 1.5, bg: 1, density: 0.7 },
  high: { dpr: 2, bg: 1, density: 1 },
} as const;
const SCALES = [1, 0.85, 0.7, 0.58];
/** Fewest particles the adaptive cap ever allows: enough for a crash to still read as one. */
const MIN_PARTICLES = 160;

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
    checkpoints: 0, marks: [], section: 0, cue: null, coach: null, countdown: 0, deathPct: 0, lastDeath: -1, bestBefore: 0,
    newBest: false, awaitRetry: false, rival: false, result: null, audio: false,
  };
  readonly live: LiveState = {
    progress: 0, streak: 0, syncRate: 0, fps: 60, pulse: 0, beat: 0, speed: 1, instances: 0, particles: 0, effects: 1, resolution: '',
    timing: { seq: 0, off: 0, hit: false }, ghost: false,
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
  private readonly pose: PlayerPose = { x: 0, y: HALF, rot: 0, mode: Mode.Cube, grav: 1, stretch: 1, alpha: 1, thrust: 0, scale: 1 };
  /** The mirrored twin of dual mode. */
  private readonly twinPose: PlayerPose = { x: 0, y: HALF, rot: 0, mode: Mode.Cube, grav: -1, stretch: 1, alpha: 0, thrust: 0, scale: 1 };
  private readonly ghostPose: PlayerPose = { x: 0, y: HALF, rot: 0, mode: Mode.Cube, grav: 1, stretch: 1, alpha: 0, thrust: 0, scale: 1 };
  private readonly twinTrail = new TrailRibbon();
  private readonly edges: InputEdge[] = [];
  private readonly pending: InputEdge[] = [];

  private settings: Settings;
  private look: Look;
  /** The twin wears the same chassis with the two paints swapped. */
  private twinLook: Look;
  private ghostLook: Look;
  private attract: Attract;
  private theme: ThemeTrack;

  // Play session
  private level: Level;
  private sim: Sim;
  private song: Song;
  private checkpoints: Checkpoint[] = [];
  /** Where a section practice run restarts from when no checkpoint is left. */
  private sectionCp: Checkpoint | null = null;
  private intro: IntroTracker | null = null;
  /** Button presses fed to the simulation this attempt. */
  private presses = 0;
  /** Ticks on which the button changed this attempt: the run, as a replay. */
  private rec: number[] = [];
  /** The attempt is a Normal run from the start, short enough to keep as a ghost. */
  private recording = false;
  private ghost: GhostRun | null = null;
  /** A run loaded from a code, to race. */
  private rival: Ghost | null = null;
  /** The best run being played back from the results screen. */
  private watch: { data: Ghost; idx: number; held: boolean } | null = null;
  /** The inputs of the last Normal run from the start, kept so it can be shared. */
  private lastRun: { level: Level; ticks: number; toggles: number[] } | null = null;
  private lastJumpX = NaN;
  private preview: { id: string; from: number; to: number; cursor: Cursor; fading: boolean } | null = null;
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
  private twinAlpha = 0;
  /** Drawn body size, easing between full size and mini. */
  private scale = 1;
  private thrust = 0;
  private cssW = 1;
  private cssH = 1;
  private needsResize = true;
  /** True while the app is blocked; no frame runs and no input is taken. */
  private suspended = false;
  private inputBeforeSuspend = false;
  private scaleIdx = 0;
  /** What the frame rate currently affords: effects at any quality setting, render resolution on Auto. */
  private readonly budget = new RenderBudget(SCALES.length);
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
    this.twinLook = this.look;
    this.ghostLook = this.look;
    this.dressTwins();
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
      this.dressTwins();
    });
    new ResizeObserver(() => { this.needsResize = true; }).observe(canvas);
    window.addEventListener('resize', () => { this.needsResize = true; });
    this.audio.onStateChange = () => this.onAudioState();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state.mode === 'play') this.pause();
        this.audio.suspend();
      } else if (!this.suspended) {
        this.audio.resume();
      }
    });
    window.addEventListener('blur', () => { if (this.state.mode === 'play') this.pause(); });
  }

  private dressTwins(): void {
    const l = this.look;
    this.twinLook = { ...l, primary: l.secondary, secondary: l.primary };
    const pale = (c: RGB): RGB => [c[0] * 0.35 + 0.6, c[1] * 0.35 + 0.6, c[2] * 0.35 + 0.6];
    // The ghost is the same chassis as an outline, so it never reads as a second player.
    this.ghostLook = { ...l, chassis: { ...l.chassis, hollow: true }, primary: pale(l.primary), secondary: pale(l.secondary) };
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
    if (!this.suspended) this.loop.start();
  }

  /**
   * Freezes the whole game while the app is blocked (a phone held upright) and
   * brings it back afterwards. A run in progress is paused, not lost: nothing
   * is simulated or drawn in between, and the player resumes it deliberately
   * from the pause menu, so a rotation can never register as a jump.
   */
  setSuspended(on: boolean): void {
    if (on === this.suspended) return;
    this.suspended = on;
    if (on) {
      if (this.state.mode === 'play') this.pause();
      this.inputBeforeSuspend = this.input.enabled;
      this.input.setEnabled(false);
      this.loop.stop();
      this.audio.suspend();
    } else {
      // The viewport has a new shape: measure the canvas again on the next frame.
      this.needsResize = true;
      this.input.setEnabled(this.inputBeforeSuspend);
      this.loop.start();
      if (!document.hidden) this.audio.resume();
    }
  }

  /** Must be called from a user gesture. Starts audio and the menu soundtrack. */
  async unlockAudio(): Promise<boolean> {
    // Nothing may start sounding while the app is blocked; the next gesture after it lifts will.
    if (this.suspended) return false;
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
      else if (this.preview) { if (!this.music.playing) this.startPreview(); }
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
    this.input.setActionKeys(s.keys.jump);
    if (s.quality !== 'auto') { this.scaleIdx = 0; this.budget.resolution.reset(); }
    this.applyEffects();
    this.needsResize = true;
  }

  /** Sets how many particles are made and kept from the quality setting and what the frame rate currently affords. */
  private applyEffects(): void {
    const share = this.budget.share;
    const base = this.settings.particles ? QUALITY[this.qualityTier()].density : 0.15;
    this.particles.density = base * share;
    this.particles.limit = Math.max(MIN_PARTICLES, Math.round(this.particles.capacity * share));
    this.live.effects = share;
  }

  private qualityTier(): 'low' | 'medium' | 'high' {
    const q = this.settings.quality;
    if (q !== 'auto') return q;
    return this.scaleIdx >= 3 ? 'low' : this.scaleIdx >= 1 ? 'medium' : 'high';
  }

  // ── Attract mode (menu backdrop) ─────────────────────────────────────────

  private makeAttract(id: string, from?: Cursor): Attract {
    const level = getLevel(referenceReplay(id) ? id : LEVEL_IDS[0]);
    const sim = new Sim(level);
    sim.emit = true;
    const a: Attract = { level, sim, toggles: referenceReplay(level.meta.id) ?? [], idx: 0, held: false, time: 0, rest: 0 };
    if (from && level.meta.id === id) {
      sim.load(from.snap);
      a.idx = from.idx;
      a.held = from.held;
      a.time = sim.tick / TICK_RATE;
    }
    return a;
  }

  /**
   * Level select: shows a track's first drop behind the menu with its own
   * music, looping. Pass null to go back to the menu soundtrack.
   */
  previewLevel(id: string | null): void {
    if (this.state.mode !== 'attract') return;
    if (id === null) {
      if (!this.preview) return;
      this.preview = null;
      this.music.stop(0.35);
      this.playMenuMusic();
      return;
    }
    if (this.preview?.id === id || !referenceReplay(id)) return;
    const route = routeOf(id);
    const w = previewWindow(route);
    this.preview = { id, from: w.from, to: w.to, cursor: route.sections[w.section].cursor, fading: false };
    this.startPreview();
  }

  private startPreview(): void {
    const pv = this.preview;
    if (!pv) return;
    pv.fading = false;
    this.attract = this.makeAttract(pv.id, pv.cursor);
    this.enterAttractView();
    if (!this.audio.running) return;
    const song = getSong(this.attract.level.meta.song);
    this.sfx.root = song.root + 12;
    this.music.stop(0.3);
    this.music.play(song, { offset: pv.from, loop: false, fadeIn: 0.6, delay: 0.12 });
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
    const pv = this.preview;
    if (pv) {
      // The picture follows the music, so the autopilot lands its jumps on the beat you hear.
      const heard = this.music.song && this.music.song.id === a.level.meta.song ? this.music.songTime() : NaN;
      if (!Number.isNaN(heard) && heard > a.time - 0.5) a.time = heard - dt;
      if (!pv.fading && a.time > pv.to - 0.8) { pv.fading = true; this.music.stop(0.8); }
      if (a.time >= pv.to || s.dead || s.won) { this.startPreview(); return; }
    }
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

  startLevel(id: string, practice: boolean, section = 0): void {
    // The daily remix follows the calendar: starting it is the moment to move on to today's.
    if (id === DAILY_ID) refreshDaily();
    const level = getLevel(id);
    if (this.rival && this.rival.sig !== levelSignature(level)) this.rival = null;
    this.lastRun = null;
    this.preview = null;
    this.level = level;
    this.sim = new Sim(level);
    this.sim.emit = true;
    this.song = getSong(level.meta.song);
    this.theme = new ThemeTrack(level);
    this.sfx.root = this.song.root + 12;
    this.music.stop(0.25);
    this.store.setLastLevel(id);
    this.set({
      mode: 'play', levelId: id, practice, attempt: 0, shards: 0, checkpoints: 0, marks: [], section: 0, cue: null, coach: null,
      countdown: 0, deathPct: 0, lastDeath: -1, bestBefore: 0, newBest: false, awaitRetry: false, result: null,
      rival: this.rival !== null,
    });
    this.checkpoints = [];
    this.setSection(practice ? section : 0);
    this.intro = id === INTRO_LEVEL && this.state.section === 0 && introWanted(this.store.profile) ? new IntroTracker() : null;
    this.particles.clear();
    this.camera.backdrop = false;
    this.input.setEnabled(true);
    this.beginAttempt(LEAD_FIRST);
  }

  private beginAttempt(lead: number): void {
    const s = this.sim;
    const cp = this.state.practice ? this.checkpoints[this.checkpoints.length - 1] ?? this.sectionCp ?? undefined : undefined;
    if (cp) s.load(cp.snap); else { s.reset(); this.checkpoints.length = 0; }
    this.presses = 0;
    this.intro?.attempt();
    this.cpLastBeat = s.beat;
    this.base = { jumps: s.jumps, orbs: s.orbs, pads: s.pads, actions: s.actions, synced: s.synced };
    this.runSeconds = 0;
    this.pending.length = 0;
    this.input.drain(this.edges);
    this.rec.length = 0;
    this.watch = null;
    this.recording = !this.state.practice && s.tick === 0;
    this.feed(this.input.held);
    this.startGhost();
    this.lastJumpX = NaN;
    this.resuming = false;
    this.trail.reset();
    this.twinTrail.reset();
    this.scale = s.mini ? MINI_HALF / HALF : 1;
    this.twinAlpha = s.dual ? 1 : 0;
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
      awaitRetry: false, newBest: false, checkpoints: this.checkpoints.length, marks: this.marks(), cue: null,
      coach: this.intro ? this.intro.view(s.beat) : null,
    });
  }

  /** Passes the button to the simulation, noting every change so the run can be replayed. */
  private feed(held: boolean): void {
    const s = this.sim;
    if (held !== s.held && this.recording) {
      if (this.rec.length < MAX_GHOST_TOGGLES) this.rec.push(s.tick); else this.recording = false;
    }
    s.setInput(held);
  }

  /**
   * Races a run loaded from a code on its level: it runs beside the player as
   * an outline. It stays until another level is started or the player leaves.
   */
  setRival(run: RunCheck | null): void {
    this.rival = run ? {
      sig: levelSignature(run.level), percent: run.percent, completed: run.completed, sync: run.sync,
      ticks: run.ticks, toggles: run.run.toggles.slice(),
    } : null;
  }

  /** The last Normal run from the start, as a code that can be given to someone else. Null when there is none. */
  runCode(): string | null {
    const run = this.lastRun;
    if (!run || run.level !== this.level) return null;
    const day = this.level.meta.id === DAILY_ID ? daily().key : null;
    return encodeRun({ ref: runRef(this.level, day), sig: runSignature(this.level), ticks: run.ticks, toggles: run.toggles });
  }

  /**
   * Puts a run loaded from a code on the start line to race. The player's own
   * best run is never shown during play: it is watched afterwards, from the
   * results screen (`watchBest`).
   */
  private startGhost(): void {
    this.ghost = null;
    this.live.ghost = false;
    if (!this.recording) return;
    const data = this.rival && this.rival.sig === levelSignature(this.level) ? this.rival : null;
    if (!data) return;
    const sim = new Sim(this.level);
    this.ghost = { data, sim, idx: 0, held: false, alpha: 0, done: false };
    this.live.ghost = true;
  }

  /** Brings the ghost up to the player's tick. */
  private stepGhost(tick: number): void {
    const g = this.ghost;
    if (!g || g.done) return;
    const sim = g.sim;
    const t = g.data.toggles;
    while (sim.tick < tick && !sim.dead && !sim.won && sim.tick < g.data.ticks) {
      while (g.idx < t.length && t[g.idx] <= sim.tick) { g.held = !g.held; sim.setInput(g.held); g.idx++; }
      sim.step();
    }
    if (sim.dead || sim.won || sim.tick >= g.data.ticks) {
      g.done = true;
      this.live.ghost = false;
      if (!sim.won && g.alpha > 0.05) this.fx.ring(sim.x, sim.y, [0.8, 0.85, 0.9], 0.3, 1.8, 0.3);
    }
  }

  // ── Watching the best run ────────────────────────────────────────────────

  /** The best Normal run on record for the track being played, or null when none is stored for this layout. */
  bestRun(): Ghost | null {
    return this.state.mode === 'play' ? this.store.ghosts.get(this.level) : null;
  }

  /**
   * From the results screen: plays the best run back on the track, with the
   * music, exactly as it was pressed. It is a recording being shown, so it
   * counts for nothing: no attempt, no record, no reward. Ends by itself, or
   * with `stopWatch`, back on the same results.
   */
  watchBest(): boolean {
    if (this.state.mode !== 'play' || this.state.phase !== 'results') return false;
    const data = this.store.ghosts.get(this.level);
    if (!data) return false;
    const s = this.sim;
    s.reset();
    s.setInput(false);
    s.events.length = 0;
    this.watch = { data, idx: 0, held: false };
    this.recording = false;
    this.ghost = null;
    this.live.ghost = false;
    this.intro = null;
    this.pending.length = 0;
    this.input.setEnabled(false);
    this.particles.clear();
    this.lastJumpX = NaN;
    this.resuming = false;
    this.trail.reset();
    this.twinTrail.reset();
    this.scale = 1;
    this.twinAlpha = 0;
    this.playerAlpha = 1;
    this.stretch = 1;
    this.stretchV = 0;
    this.timer = 0;
    this.syncCues(0);
    this.camera.zoomTarget = this.zoomAt(0);
    this.camera.follow(xAtBeat(this.level, -LEAD_RETRY / this.level.beatDur), s.y, 0, true);
    this.transport.start(this.song, 0, LEAD_RETRY);
    this.set({ phase: 'replay', shards: 0, cue: null, coach: null, countdown: 0, awaitRetry: false });
    return true;
  }

  /** Ends the playback and puts the results back up. */
  stopWatch(): void {
    if (this.state.mode !== 'play' || this.state.phase !== 'replay') return;
    this.watch = null;
    this.transport.stop(0.08);
    this.set({ phase: 'results', cue: null });
  }

  private updateWatch(dt: number): void {
    const w = this.watch;
    const s = this.sim;
    if (!w) { this.stopWatch(); return; }
    // The run is over: hold on its last moment, then go back to the results.
    if (s.dead || s.won || s.tick >= w.data.ticks) {
      this.timer += dt;
      if (this.timer > (s.won ? 1.9 : 1.1)) this.stopWatch();
      return;
    }
    const t = this.transport.time();
    let target = Math.floor(t * TICK_RATE);
    let resync = false;
    if (target - s.tick > MAX_CATCHUP) { target = s.tick + MAX_CATCHUP; resync = true; }
    const toggles = w.data.toggles;
    while (s.tick < target && !s.dead && !s.won && s.tick < w.data.ticks) {
      while (w.idx < toggles.length && toggles[w.idx] <= s.tick) { w.held = !w.held; s.setInput(w.held); w.idx++; }
      s.step();
      this.trail.push(s.x, s.y);
    }
    if (resync && !s.dead && !s.won) this.transport.start(this.song, s.tick / TICK_RATE, 0);
    this.handleEvents(s, true);
    this.runTriggers(s.beat);
    if (s.won) {
      this.timer = 0;
      this.wonX = s.x;
      this.sfx.play('win');
    } else if (s.dead || s.tick >= w.data.ticks) {
      // The best so far was not a clear: this is where it ended.
      this.timer = 0;
      this.transport.stop(0.05);
      if (s.dead) { this.sfx.play('death'); this.playerAlpha = 0; }
    }
  }

  /** Offers the attempt that just ended as the new best run. */
  private keepGhost(completed: boolean): void {
    if (!this.recording || this.state.practice) return;
    const s = this.sim;
    this.lastRun = { level: this.level, ticks: s.tick, toggles: this.rec.slice() };
    this.store.ghosts.offer(this.level, {
      percent: completed ? 100 : Math.min(99, Math.floor(s.progress * 100)), completed,
      sync: s.actions > 0 ? s.synced / s.actions : 0, ticks: s.tick, toggles: this.rec,
    });
    this.recording = false;
  }

  private marks(): number[] {
    const endX = this.level.endX;
    return this.checkpoints.map((c) => Math.max(0, Math.min(1, c.x / endX)));
  }

  /** Chooses where practice runs on this visit begin. Part 0 is the start of the track. */
  private setSection(section: number): void {
    const parts = routeOf(this.level.meta.id).sections;
    const part = section > 0 && section < parts.length ? parts[section] : null;
    if (!part) {
      this.sectionCp = null;
      if (this.state.section !== 0) this.set({ section: 0 });
      return;
    }
    const snap = sectionStart(part);
    this.sectionCp = { snap, x: snap.x, y: snap.y, fails: 0 };
    this.set({ section: part.index });
  }

  /** Ends the guided intro for good, whether it was finished or skipped. */
  endIntro(): void {
    if (!this.intro) return;
    this.intro = null;
    this.store.updateSeen([INTRO_DONE], [INTRO_AGAIN]);
    if (this.state.coach) this.set({ coach: null });
  }

  private updateIntro(): void {
    const intro = this.intro;
    if (!intro) return;
    const beat = this.sim.beat;
    if (intro.finished(beat)) { this.endIntro(); return; }
    const v = intro.view(beat);
    const c = this.state.coach;
    if (!c || c.step !== v.step || c.done !== v.done) this.set({ coach: v });
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
      // The hints written into a track are for whoever is playing it, not for somebody watching a recording.
      if (t.kind === 'text') { if (this.state.phase !== 'replay') this.set({ cue: { id: ++this.cueId, text: t.text, sub: t.sub } }); }
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
      case 'replay':
        this.updateWatch(dt);
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
        if (down) this.presses++;
        this.feed(down);
        // A press always lasts at least one tick, so a tap shorter than a
        // tick (or a press and release delivered together) still registers.
        if (down) break;
      }
      s.step();
      this.trail.push(s.x, s.y);
    }
    if (ei > 0) pend.splice(0, ei);
    this.stepGhost(s.tick);
    if (resync && !s.dead && !s.won) this.transport.start(this.song, s.tick / TICK_RATE, 0);

    if (this.state.phase === 'running') this.runSeconds += dt;
    this.handleEvents(s, true);
    this.runTriggers(s.beat);
    this.updateIntro();

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
    this.set({ checkpoints: this.checkpoints.length, marks: this.marks() });
  }

  /** Practice mode: discard the most recent checkpoint. */
  removeCheckpoint(): void {
    if (!this.state.practice || this.checkpoints.length === 0) return;
    this.checkpoints.pop();
    this.cpLastBeat = this.sim.beat;
    this.sfx.play('back');
    this.set({ checkpoints: this.checkpoints.length, marks: this.marks() });
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
      section: this.state.practice && this.state.section > 0,
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
    this.keepGhost(false);
    this.timer = this.state.practice ? 0.6 : 0.9;
    this.set({
      phase: 'dead', deathPct: Math.min(99, Math.floor(s.progress * 100)), lastDeath: s.progress, bestBefore: outcome.previousBest,
      newBest: outcome.newBest && !this.state.practice && s.progress > 0.02, checkpoints: this.checkpoints.length, marks: this.marks(),
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
    this.keepGhost(true);
    this.set({
      phase: 'results',
      result: {
        levelId: this.level.meta.id, practice: this.state.practice, section: this.state.practice ? this.state.section : 0,
        attempts: this.state.attempt,
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
    this.feed(false);
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

  /**
   * Restarts the run, optionally switching mode. A practice run that was
   * started from a part of the track restarts from that part unless another
   * one is given.
   */
  restart(practice = this.state.practice, section = practice ? this.state.section : 0): void {
    if (this.state.mode !== 'play') return;
    this.abandon();
    this.watch = null;
    this.checkpoints.length = 0;
    this.input.setEnabled(true);
    this.set({ practice, result: null, checkpoints: 0, marks: [], lastDeath: practice === this.state.practice ? this.state.lastDeath : -1 });
    this.setSection(practice ? section : 0);
    // The intro belongs to a run from the start; practising a later part leaves it for another visit.
    if (this.state.section > 0 && this.intro) {
      this.intro = null;
      this.set({ coach: null });
    }
    this.beginAttempt(this.state.section > 0 ? LEAD_SECTION : LEAD_RETRY);
  }

  /** Practice mode from the start of a part of the track (0 is the beginning). */
  practiceFrom(section: number): void {
    this.restart(true, section);
  }

  /** Records a run that is being left unfinished. */
  private abandon(): void {
    const ph = this.state.phase;
    this.transport.stop(0.08);
    if ((ph === 'running' || ph === 'paused' || ph === 'countdown') && this.sim.tick > 0 && !this.sim.dead && !this.sim.won) {
      this.report(false, false);
      this.keepGhost(false);
    }
  }

  /** Leaves the level and returns to the menu backdrop. */
  exitLevel(): void {
    if (this.state.mode !== 'play') return;
    this.abandon();
    this.music.stop(0.2);
    this.input.setEnabled(false);
    this.attract = this.makeAttract(this.level.meta.id);
    this.intro = null;
    this.rival = null;
    this.lastRun = null;
    this.watch = null;
    this.set({ mode: 'attract', phase: 'running', cue: null, coach: null, result: null, countdown: 0, awaitRetry: false, rival: false });
    this.enterAttractView();
    this.playMenuMusic();
  }

  // ── Events → feedback ────────────────────────────────────────────────────

  private handleEvents(s: Sim, audible: boolean): void {
    const ev = s.events;
    if (ev.length === 0) return;
    const pal = this.theme.current;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      const look = e.twin ? this.twinLook : this.look;
      const grav = e.twin ? s.tgrav : s.grav;
      switch (e.type) {
        case Ev.Jump: {
          this.fx.jump(e.x, e.y, grav, e.a ? WHITE : look.primary, e.a === 1);
          // In dual mode both bodies answer one press: it is still one jump to the ear and to the timing cue.
          const echo = e.twin && e.x === this.lastJumpX;
          this.lastJumpX = e.x;
          if (echo) break;
          this.kick(0.16);
          if (audible) {
            this.sfx.play(e.a ? 'sync' : 'jump', s.streak);
            this.intro?.jumped(this.presses, s.streak);
            this.timed(e.off, e.a === 1);
          }
          break;
        }
        case Ev.Land:
          this.fx.land(e.x, e.y, grav, look.primary, Math.min(1, e.a / 160));
          if (e.twin) break;
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
          if (audible) {
            this.sfx.play(sub === 1 ? 'orbGravity' : 'orb');
            this.timed(e.off, (e.a & 16) !== 0);
          }
          break;
        }
        case Ev.Pad: {
          const c = padColor(e.a);
          this.fx.ring(e.x, e.y, c, 0.5, 3.4, 0.36);
          this.fx.burst(e.x, e.y - 0.3 * grav, c, 10, 8);
          this.kick(0.22);
          if (audible) this.sfx.play(e.a === 1 ? 'padGravity' : 'pad');
          break;
        }
        case Ev.Gate: {
          const c = gateColor(e.a, 0);
          this.fx.gate(e.x, e.y, c);
          if (e.a === Gate.Dual) this.fx.gate(e.x, s.ty, c);
          if (e.a === Gate.Solo) {
            this.fx.gate(e.x, this.twinPose.y, c);
            this.fx.burst(e.x, this.twinPose.y, this.twinLook.primary, 10, 6);
          }
          if (e.a === Gate.Mini) this.kick(-0.25); else if (e.a === Gate.Big) this.kick(0.25);
          if (audible) this.sfx.play('gate');
          if (e.a <= Gate.Wave) { this.trail.reset(); this.twinTrail.reset(); }
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

  /** Publishes how a jump or orb sat against the beat, for the timing cue. */
  private timed(off: number, hit: boolean): void {
    const t = this.live.timing;
    t.seq++;
    t.off = off;
    t.hit = hit;
  }

  /** Squash-and-stretch impulse (positive stretches vertically). */
  private kick(v: number): void {
    if (this.settings.reducedMotion) return;
    this.stretch = 1 + v;
    this.stretchV = 0;
  }

  // ── Frame ────────────────────────────────────────────────────────────────

  private frame(dt: number): void {
    if (this.renderer.lost || this.suspended) return;
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
    let lerp = 0;
    const pose = this.pose;
    const moving = this.state.phase === 'running' || this.state.phase === 'replay';
    const running = play ? moving || this.state.phase === 'countdown' : !s.dead && !s.won;
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
    } else if (running && !s.dead && play && moving) {
      const f = this.transport.time() * TICK_RATE - s.tick;
      const k = f < 0 ? 0 : f > 1 ? 1 : f;
      lerp = k;
      pose.x = s.x + (s.x - s.px) * k;
      pose.y = s.y + (s.y - s.py) * k;
      pose.rot = s.rot + (s.rot - s.prot) * k;
    } else {
      pose.x = s.x; pose.y = s.y; pose.rot = s.rot;
    }
    pose.mode = s.mode;
    pose.grav = s.grav;

    // The twin of dual mode shares the player's column and vehicle; it keeps its last place while it fades.
    const twin = this.twinPose;
    twin.x = pose.x;
    twin.mode = s.mode;
    if (s.dual) {
      twin.y = s.ty + (s.ty - s.tpy) * lerp;
      twin.rot = s.trot + (s.trot - s.tprot) * lerp;
      twin.grav = s.tgrav;
    }
    // While both are on screen the camera frames the pair, not the player alone.
    const focusY = s.dual ? (pose.y + twin.y) / 2 : pose.y;

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
      this.camera.follow(s.won ? this.wonX : pose.x, focusY, dt);
      if (!s.dead && this.playerAlpha > 0) {
        this.trail.push(pose.x, pose.y);
        if (s.dual) this.twinTrail.push(twin.x, twin.y);
      }
      this.scale = damp(this.scale, s.mini ? MINI_HALF / HALF : 1, 22, dt);
      this.twinAlpha = damp(this.twinAlpha, s.dual ? 1 : 0, 16, dt);
      if (this.twinAlpha < 0.02 && !s.dual) this.twinTrail.reset();
    }
    pose.stretch = s.mode === Mode.Cube ? Math.max(0.6, Math.min(1.35, this.stretch)) : 1;
    pose.alpha = this.playerAlpha;
    pose.thrust = this.thrust;
    pose.scale = this.scale;
    twin.stretch = pose.stretch;
    twin.thrust = this.thrust;
    twin.scale = this.scale;
    twin.alpha = this.playerAlpha * this.twinAlpha;
    this.poseGhost(play && !frozen ? dt : 0, play);

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
    // A paused game is a still picture: its frames say nothing about what the run can afford.
    if (!frozen) this.govern(dt);
  }

  /** Places the ghost for this frame and fades it in and out. */
  private poseGhost(dt: number, play: boolean): void {
    const g = this.ghost;
    const gp = this.ghostPose;
    if (!g || !play) { gp.alpha = 0; return; }
    const gs = g.sim;
    const s = this.sim;
    const shown = !g.done && gs.tick > 0 && !s.dead && !s.won && this.state.phase !== 'dead';
    if (dt > 0) g.alpha = damp(g.alpha, shown ? 1 : 0, shown ? 6 : 12, dt);
    gp.alpha = g.alpha * 0.5 * this.playerAlpha;
    if (g.done) return;
    const running = this.state.phase === 'running';
    const f = running ? this.transport.time() * TICK_RATE - gs.tick : 0;
    const k = f < 0 ? 0 : f > 1 ? 1 : f;
    gp.x = gs.x + (gs.x - gs.px) * k;
    gp.y = gs.y + (gs.y - gs.py) * k;
    gp.rot = gs.rot + (gs.rot - gs.prot) * k;
    gp.mode = gs.mode;
    gp.grav = gs.grav;
    gp.scale = gs.mini ? MINI_HALF / HALF : 1;
    gp.thrust = gs.mode === Mode.Ship && gs.held ? 1 : 0;
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
      while (this.dustAcc > 1) {
        this.dustAcc -= 1;
        this.fx.dust(pose.x, pose.y, s.grav, this.look.primary, vx);
        if (s.dual && s.tgrounded) this.fx.dust(pose.x, this.twinPose.y, s.tgrav, this.twinLook.primary, vx);
      }
    } else if (s.mode === Mode.Ship && s.held) {
      this.fx.thrust(pose.x - 0.7, pose.y - 0.1 * s.grav, this.look.secondary, vx, s.vy);
    }
    if (this.look.trail.sparks && Math.random() < dt * 40) this.fx.spark(pose.x - 0.4, pose.y, this.look.primary);
  }

  private render(s: Sim, beat: number, pulse: number): void {
    const r = this.renderer;
    const cam = this.camera;
    const pal = this.theme.at(beat);
    r.begin();

    const bg = this.bg;
    bg.time = this.time;
    bg.pulse = pulse;
    bg.energy = this.beatInfo.energy;
    bg.horizon = cam.horizonPx;
    bg.scroll = cam.x * cam.scale;
    // The skyline and stars follow the quality the player chose and nothing else. They fill the screen, so taking
    // them away and bringing them back as the frame rate moved read as the picture cutting out.
    const chosen = this.settings.quality;
    bg.quality = QUALITY[chosen === 'auto' ? 'high' : chosen].bg;
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

    // The ghost goes underneath everything that belongs to the live run.
    if (this.ghostPose.alpha > 0.01) {
      const g = this.ghost;
      drawPlayer(r, this.ghostLook, this.ghostPose, 0);
      if (g && g.sim.dual) {
        const gp = this.ghostPose;
        const y = gp.y, rot = gp.rot, grav = gp.grav;
        gp.y = g.sim.ty; gp.rot = g.sim.trot; gp.grav = g.sim.tgrav;
        drawPlayer(r, this.ghostLook, gp, 0);
        gp.y = y; gp.rot = rot; gp.grav = grav;
      }
    }
    this.trail.draw(r, this.look, s.mode, pulse, this.pose.alpha);
    if (this.twinPose.alpha > 0.01) this.twinTrail.draw(r, this.twinLook, s.mode, pulse, this.twinPose.alpha);
    this.particles.draw(r, cam.left - 2, cam.right + 4);
    if (this.twinPose.alpha > 0.01) drawPlayer(r, this.twinLook, this.twinPose, pulse);
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

  /** Keeps the frame rate: thins effects when frames run long and, on Auto, lowers the render resolution after that. */
  private govern(dt: number): void {
    const moved = this.budget.update(dt, this.settings.quality === 'auto');
    if (moved === 0) return;
    if (moved & 2) {
      this.scaleIdx = this.budget.resolution.step;
      this.needsResize = true;
    }
    this.applyEffects();
  }
}
