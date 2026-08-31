import type { Engine } from '../../engine/core/Engine.ts';
import type { CanvasRenderer } from '../../engine/graphics/CanvasRenderer.ts';
import type { IScene } from '../../engine/scene/IScene.ts';
import { Logger } from '../../engine/utils/Logger.ts';
import { Player } from '../entities/Player.ts';
import { Ground } from '../entities/Ground.ts';
import { Platform } from '../entities/Platform.ts';
import { Spike } from '../entities/Spike.ts';
import { Goal } from '../entities/Goal.ts';
import { TUTORIAL_LEVEL, ALL_LEVELS, type LevelData } from '../levels/LevelData.ts';
import { Vector2 } from '../../engine/utils/Vector2.ts';
import { SoundManager } from '../../engine/audio/SoundManager.ts';
import { Haptics } from '../../engine/haptics/HapticsManager.ts';
import { GameStateManager } from '../state/GameState.ts';

/**
 * High-performance, precision auto-runner PlayableScene for Rush Engine.
 * Features:
 * - Dynamic continuous camera tracking (player locked at 1/3 viewport width)
 * - 5 Handcrafted progressive difficulty levels
 * - Integrated real-time procedural Web Audio SFX & Synth Soundtrack
 * - 0.08s hitstop freeze frame + screen flash + sub-0.5s instant restart on death
 * - Precision percentage progress tracking
 */
export class PlayableScene implements IScene {
  public static activeInstance: PlayableScene | null = null;

  public readonly name: string = 'PlayableScene';
  private engine: Engine | null = null;

  public player!: Player;
  public groundSections: Ground[] = [];
  public platforms: Platform[] = [];
  public spikes: Spike[] = [];
  public goal!: Goal;

  public levelData: LevelData = TUTORIAL_LEVEL;
  public attempts: number = 1;
  public isPaused: boolean = true;
  public elapsedTime: number = 0;

  // Visual preferences
  public enableScreenFlash: boolean = true;

  // Death feel: Hitstop + Screen Flash + Sub-0.5s Fast Restart
  private hitstopTimer: number = 0;
  private readonly hitstopDuration: number = 0.08;
  private screenFlashAlpha: number = 0;
  private deathRestartTimer: number = 0;
  private isProcessingDeath: boolean = false;

  // Victory state
  public isVictory: boolean = false;
  public victoryTimer: number = 0;
  private victoryParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    alpha: number;
  }> = [];

  public init(engine: Engine): void {
    this.engine = engine;
    this.loadLevel(this.levelData);
    Logger.info(this.name, `Initialized with ${this.levelData.name}`);
  }

  public onEnter(): void {
    if (!this.isPaused) {
      SoundManager.getInstance().startMusic();
    }
    Logger.info(this.name, 'Entered level. [Space] Jump, [R] Restart, [Esc] Pause.');
  }

  public onExit(): void {
    SoundManager.getInstance().stopMusic();
    Logger.info(this.name, 'Exited level.');
  }

  /**
   * Builds all level entities and binds player callbacks.
   */
  public loadLevel(level: LevelData, resetAttempts: boolean = true): void {
    this.levelData = level;
    if (resetAttempts) {
      this.attempts = 1;
    }
    this.elapsedTime = 0;
    this.hitstopTimer = 0;
    this.screenFlashAlpha = 0;
    this.deathRestartTimer = 0;
    this.isProcessingDeath = false;
    this.isVictory = false;
    this.victoryTimer = 0;
    this.victoryParticles = [];

    // 1. Build Ground sections
    this.groundSections = level.groundSections.map(
      (g) =>
        new Ground({
          x: g.x,
          y: g.y,
          width: g.width,
          height: g.height,
        })
    );

    // 2. Build Platforms
    this.platforms = level.platforms.map(
      (p) =>
        new Platform({
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height ?? 20,
        })
    );

    // 3. Build Spikes
    this.spikes = level.spikes.map(
      (s) =>
        new Spike({
          x: s.x,
          y: s.y,
          width: s.width ?? 28,
          height: s.height ?? 30,
        })
    );

    // 4. Build Goal
    this.goal = new Goal({
      x: level.goal.x,
      y: level.goal.y,
      width: level.goal.width,
      height: level.goal.height,
    });

    // 5. Build Player Cube
    this.player = new Player({
      spawnPosition: new Vector2(level.playerStart.x, level.playerStart.y),
      size: 32,
      moveSpeed: 310,
      jumpVelocity: -550,
      gravity: 1750,
    });

    this.player.onDeath = () => this.handlePlayerDeath();
    this.player.onWin = () => this.handlePlayerWin();
  }

  /**
   * Switches to next sequential level if available.
   */
  public nextLevel(): boolean {
    const currentIndex = ALL_LEVELS.findIndex((l) => l.id === this.levelData.id);
    if (currentIndex >= 0 && currentIndex < ALL_LEVELS.length - 1) {
      this.loadLevel(ALL_LEVELS[currentIndex + 1], true);
      return true;
    }
    return false;
  }

  /**
   * Returns current level completion progress percentage (0 - 100).
   */
  public getProgress(): number {
    if (!this.player || !this.goal) return 0;
    const startX = this.levelData.playerStart.x;
    const goalX = this.goal.transform.position.x;
    const currentX = this.player.transform.position.x;
    const totalDist = goalX - startX;
    if (totalDist <= 0) return 0;
    const p = Math.max(0, Math.min(100, ((currentX - startX) / totalDist) * 100));
    return Math.floor(p);
  }

  /**
   * Triggered when player hits a hazard or pit.
   */
  private handlePlayerDeath(): void {
    if (this.isProcessingDeath) return;
    this.isProcessingDeath = true;
    this.hitstopTimer = this.hitstopDuration;
    if (this.enableScreenFlash) {
      this.screenFlashAlpha = 0.45; // Subtle crisp flash
    }
    this.deathRestartTimer = 0.28; // Total death duration ~0.36s (well under 0.5s)

    Haptics.play('heavy');
    SoundManager.getInstance().playDeath();
  }

  /**
   * Triggered when player touches the goal gate.
   */
  private handlePlayerWin(): void {
    if (this.isVictory) return;
    this.isVictory = true;

    Haptics.play('success');
    SoundManager.getInstance().playVictory();

    // Spawn celebratory victory particles around goal
    const gx = this.goal.transform.position.x + this.goal.width / 2;
    const gy = this.goal.transform.position.y + this.goal.height / 2;
    const colors = ['#00FF88', '#00E5FF', '#FFFFFF', '#6EE7B7', '#FDE047'];
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 320;
      this.victoryParticles.push({
        x: gx,
        y: gy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
        alpha: 1.0,
      });
    }

    // Save level completion stats to GameStateManager
    GameStateManager.getInstance().recordLevelVictory(
      this.levelData.id,
      this.attempts,
      this.elapsedTime
    );
  }

  /**
   * Safely pauses the scene and soundtrack.
   */
  public pause(): void {
    this.isPaused = true;
    SoundManager.getInstance().stopMusic();
  }

  /**
   * Safely resumes the scene and soundtrack.
   */
  public resume(): void {
    this.isPaused = false;
    SoundManager.getInstance().startMusic();
  }

  /**
   * Restarts the level instantly with zero lag.
   * Clears all death/victory states, particles, and safely unpauses the engine if paused.
   */
  public restart(): void {
    if (this.isPaused && this.engine) {
      this.isPaused = false;
      this.engine.resume();
    }

    this.attempts++;
    this.elapsedTime = 0;
    this.hitstopTimer = 0;
    this.screenFlashAlpha = 0;
    this.deathRestartTimer = 0;
    this.isProcessingDeath = false;
    this.isVictory = false;
    this.victoryTimer = 0;
    this.victoryParticles = [];
    this.player.respawn();
    Logger.debug(this.name, `Respawned • Attempt #${this.attempts}`);
  }

  /**
   * Fixed 60Hz physics and deterministic simulation tick.
   */
  public fixedUpdate(fixedDelta: number): void {
    if (this.isPaused) return;

    // Hitstop freeze frame handling
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= fixedDelta;
      return; // Freeze world simulation during hitstop
    }

    // Death countdown before instant restart
    if (this.isProcessingDeath) {
      this.deathRestartTimer -= fixedDelta;
      if (this.deathRestartTimer <= 0) {
        this.restart();
      }
      return;
    }

    if (!this.isVictory) {
      this.elapsedTime += fixedDelta;
    }

    // Normal gameplay physics
    this.player.fixedUpdate(
      fixedDelta,
      this.groundSections,
      this.platforms,
      this.spikes,
      this.goal
    );

    // Update victory particles
    if (this.isVictory) {
      this.victoryTimer += fixedDelta;
      for (let i = this.victoryParticles.length - 1; i >= 0; i--) {
        const vp = this.victoryParticles[i];
        vp.x += vp.vx * fixedDelta;
        vp.y += vp.vy * fixedDelta;
        vp.vy += 420 * fixedDelta; // Gravity on confetti
        vp.alpha -= 0.75 * fixedDelta;
        if (vp.alpha <= 0) {
          this.victoryParticles.splice(i, 1);
        }
      }
    }
  }

  /**
   * Variable rate frame update for input and visual transitions.
   */
  public update(delta: number): void {
    if (!this.engine) return;
    const input = this.engine.input;

    // Screen flash decay
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - delta * 4.0);
    }

    // Manual Restart [R] - Accessible even when paused or dying
    if (
      input.isActionPressed('restart') ||
      input.isKeyPressed('KeyR') ||
      input.isKeyPressed('r') ||
      input.isKeyPressed('R')
    ) {
      this.restart();
      return;
    }

    // Fast manual restart during victory via Space/Tap/R
    if (
      this.isVictory &&
      (input.isActionPressed('jump') ||
        input.isActionPressed('restart') ||
        input.isKeyPressed('Space') ||
        input.isKeyPressed(' ') ||
        input.isKeyPressed('KeyR') ||
        input.isKeyPressed('r'))
    ) {
      this.restart();
      return;
    }

    // Pause toggle [Escape]
    if (
      input.isActionPressed('pause') ||
      input.isKeyPressed('Escape') ||
      input.isKeyPressed('Esc')
    ) {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        this.engine.pause();
      } else {
        this.engine.resume();
      }
      return;
    }

    if (this.isPaused) return;

    // Player jump input
    this.player.handleInput(input);
  }

  /**
   * Renders the game world with a dynamic camera tracking the player at 1/3 viewport.
   */
  public render(renderer: CanvasRenderer, _alpha: number): void {
    if (!this.engine) return;

    const screenWidth = this.engine.canvasManager.width;
    const screenHeight = this.engine.canvasManager.height;

    // 1. Dark Charcoal Background (#111827)
    renderer.clear('#111827');

    // Virtual viewport reference height (stable 540px view)
    const viewHeight = 540;
    const scale = screenHeight / viewHeight;
    const viewWidth = screenWidth / scale;

    // Camera Positioning: Lock player roughly one-third (1/3) from the left
    const playerX = this.player.transform.position.x;
    const targetCameraX = playerX - viewWidth * 0.33;
    const maxCameraX = Math.max(0, this.goal.transform.position.x + 200 - viewWidth * 0.6);
    const cameraX = Math.min(Math.max(0, targetCameraX), maxCameraX);
    const cameraY = 0;

    renderer.save();
    renderer.scale(scale, scale);
    renderer.translate(-cameraX, -cameraY);

    // 2. Subtle Background Speed Grid & Milestone Lines
    const gridSpacing = 120;
    const startGridX = Math.floor(cameraX / gridSpacing) * gridSpacing;
    const endGridX = cameraX + viewWidth + gridSpacing;

    for (let gx = startGridX; gx < endGridX; gx += gridSpacing) {
      renderer.drawLine(gx, 0, gx, viewHeight, {
        stroke: '#1F2937',
        lineWidth: 1,
      });
    }

    // Horizontal speed lines
    renderer.drawLine(cameraX, 420, cameraX + viewWidth, 420, {
      stroke: '#1F2937',
      lineWidth: 1,
    });
    renderer.drawLine(cameraX, 300, cameraX + viewWidth, 300, {
      stroke: '#1A2332',
      lineWidth: 1,
    });

    // 3. Render Ground Sections (#2D3748)
    for (const g of this.groundSections) {
      if (g.transform.position.x + g.width >= cameraX && g.transform.position.x <= cameraX + viewWidth) {
        g.render(renderer);
      }
    }

    // 4. Render Platforms (#2D3748 with high contrast edges)
    for (const p of this.platforms) {
      if (p.transform.position.x + p.width >= cameraX && p.transform.position.x <= cameraX + viewWidth) {
        p.render(renderer);
      }
    }

    // 5. Render Spikes (#FF3B3B)
    for (const s of this.spikes) {
      if (s.transform.position.x + s.width >= cameraX && s.transform.position.x <= cameraX + viewWidth) {
        s.render(renderer);
      }
    }

    // 6. Render Goal (#00FF88)
    this.goal.render(renderer);

    // 7. Render Victory Confetti / Beams
    for (const vp of this.victoryParticles) {
      const a = Math.max(0, Math.min(1, vp.alpha));
      renderer.drawRect(vp.x, vp.y, vp.size, vp.size, {
        fill: vp.color.startsWith('#')
          ? vp.color
          : `rgba(0, 255, 136, ${a})`,
        centerOrigin: true,
      });
    }

    // 8. Render Player Cube (#00E5FF)
    this.player.render(renderer);

    renderer.restore();

    // 9. Screen Flash on Death (Hitstop Feedback)
    if (this.screenFlashAlpha > 0 && this.enableScreenFlash) {
      renderer.drawRect(0, 0, screenWidth, screenHeight, {
        fill: `rgba(255, 255, 255, ${this.screenFlashAlpha})`,
      });
    }
  }

  public destroy(): void {
    this.engine = null;
    this.groundSections = [];
    this.platforms = [];
    this.spikes = [];
    this.victoryParticles = [];
    Logger.info(this.name, 'Scene destroyed.');
  }
}
