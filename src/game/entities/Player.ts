import { Transform } from '../../engine/core/Transform.ts';
import { Rigidbody2D } from '../../engine/physics/Rigidbody2D.ts';
import { BoxCollider } from '../../engine/physics/BoxCollider.ts';
import { Vector2 } from '../../engine/utils/Vector2.ts';
import { SoundManager } from '../../engine/audio/SoundManager.ts';
import { GameStateManager } from '../state/GameState.ts';
import type { SkinData } from '../skins/SkinData.ts';
import type { CanvasRenderer } from '../../engine/graphics/CanvasRenderer.ts';
import type { InputManager } from '../../engine/input/InputManager.ts';
import type { Platform } from './Platform.ts';
import type { Ground } from './Ground.ts';
import type { Spike } from './Spike.ts';
import type { Goal } from './Goal.ts';

export interface PlayerConfig {
  spawnPosition?: Vector2;
  size?: number;
  moveSpeed?: number;
  jumpVelocity?: number;
  gravity?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
}

interface GhostTrail {
  x: number;
  y: number;
  rotation: number;
  alpha: number;
}

/**
 * Modern Precision Auto-Runner Player Cube for Rush Engine.
 * Features:
 * - Constant automatic forward momentum (never stops)
 * - Responsive jump with jump buffering (0.12s) and coyote time (0.08s)
 * - Snappy rotation and landing alignment
 * - Bright cyan (#00E5FF) visual styling with dynamic particle trails
 */
export class Player {
  public readonly transform: Transform;
  public readonly rb: Rigidbody2D;
  public readonly collider: BoxCollider;

  public readonly size: number;
  public readonly moveSpeed: number;
  public readonly jumpVelocity: number;
  public readonly spawnPosition: Vector2;

  public isGrounded: boolean = false;
  public isDead: boolean = false;
  public hasWon: boolean = false;

  // Jump feel buffers
  private jumpBufferTimer: number = 0;
  private readonly jumpBufferWindow: number = 0.12;
  private coyoteTimer: number = 0;
  private readonly coyoteWindow: number = 0.08;

  // Visuals & Effects
  private visualRotation: number = 0;
  private squash: number = 0;
  private trails: GhostTrail[] = [];
  private trailTimer: number = 0;
  public particles: Particle[] = [];

  // Death callback trigger
  public onDeath?: () => void;
  public onWin?: () => void;

  constructor(config: PlayerConfig = {}) {
    this.size = config.size ?? 32;
    this.spawnPosition = config.spawnPosition ? config.spawnPosition.clone() : new Vector2(120, 388);
    this.moveSpeed = config.moveSpeed ?? 310;
    this.jumpVelocity = config.jumpVelocity ?? -550;
    const gravity = config.gravity ?? 1750;

    this.transform = new Transform(this.spawnPosition.clone(), 0, new Vector2(1, 1));

    this.rb = new Rigidbody2D({
      gravity,
      useGravity: true,
      velocity: new Vector2(this.moveSpeed, 0),
    });

    this.collider = new BoxCollider({
      width: this.size,
      height: this.size,
      offset: new Vector2(0, 0),
    });
  }

  /**
   * Resets player state and repositions to spawn coordinates instantly.
   */
  public respawn(): void {
    this.transform.position.copy(this.spawnPosition);
    this.transform.rotation = 0;
    this.visualRotation = 0;
    this.squash = 0;
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    this.trails = [];
    this.particles = [];

    this.rb.reset();
    this.rb.velocity.set(this.moveSpeed, 0);

    this.isDead = false;
    this.hasWon = false;
    this.isGrounded = true;
  }

  /**
   * Triggers player death state.
   */
  public die(): void {
    if (this.isDead || this.hasWon) return;
    this.isDead = true;
    this.rb.velocity.set(0, 0);

    // Spawn death burst particles
    const cx = this.transform.position.x + this.size / 2;
    const cy = this.transform.position.y + this.size / 2;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 120 + Math.random() * 220;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        alpha: 1.0,
        decay: 2.2 + Math.random() * 1.5,
        color: '#00E5FF',
      });
    }

    if (this.onDeath) {
      this.onDeath();
    }
  }

  /**
   * Triggers victory state.
   */
  public win(): void {
    if (this.isDead || this.hasWon) return;
    this.hasWon = true;
    this.rb.velocity.set(0, 0);

    if (this.onWin) {
      this.onWin();
    }
  }

  /**
   * Frame input check with jump buffering.
   * Uses unified isActionPressed('jump') / isActionDown('jump') so jumping triggers via Keyboard (Space/Up/W), Mouse click, Touch tap, or Stylus pen.
   */
  public handleInput(input: InputManager): void {
    if (this.isDead || this.hasWon) return;

    if (
      input.isActionPressed('jump') ||
      input.isActionDown('jump') ||
      input.isKeyPressed('Space') ||
      input.isKeyDown('Space') ||
      input.isKeyPressed(' ') ||
      input.isKeyDown(' ') ||
      input.isKeyPressed('ArrowUp') ||
      input.isKeyDown('ArrowUp') ||
      input.isKeyPressed('KeyW') ||
      input.isKeyDown('KeyW')
    ) {
      this.jumpBufferTimer = this.jumpBufferWindow;
    }
  }

  /**
   * Executes a jump with particle feedback.
   */
  private executeJump(): void {
    this.rb.velocity.y = this.jumpVelocity;
    this.isGrounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;

    SoundManager.getInstance().playJump();

    // Spawn jump dust particles at base
    const bx = this.transform.position.x + this.size / 2;
    const by = this.transform.position.y + this.size;
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: bx + (Math.random() - 0.5) * 20,
        y: by,
        vx: -60 - Math.random() * 80,
        vy: -20 - Math.random() * 40,
        size: 3 + Math.random() * 3,
        alpha: 0.8,
        decay: 3.5,
        color: '#00E5FF',
      });
    }
  }

  /**
   * Fixed timestep physics and collision update.
   */
  public fixedUpdate(
    fixedDeltaTime: number,
    groundSections: Ground[],
    platforms: Platform[],
    spikes: Spike[],
    goal: Goal
  ): void {
    // Update active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * fixedDeltaTime;
      p.y += p.vy * fixedDeltaTime;
      p.alpha -= p.decay * fixedDeltaTime;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    if (this.isDead || this.hasWon) return;

    // Decay jump buffer and coyote timers
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= fixedDeltaTime;
    if (this.coyoteTimer > 0) this.coyoteTimer -= fixedDeltaTime;

    // Attempt jump if buffered and either grounded or inside coyote window
    if (this.jumpBufferTimer > 0 && (this.isGrounded || this.coyoteTimer > 0)) {
      this.executeJump();
    }

    const wasGrounded = this.isGrounded;
    this.isGrounded = false;

    // Sub-stepping configuration for Continuous Collision Detection (CCD)
    // Divides each frame's velocity into smaller segments and re-runs AABB checks per sub-step
    const SUB_STEPS = 6;
    const subDt = fixedDeltaTime / SUB_STEPS;

    for (let step = 0; step < SUB_STEPS; step++) {
      if (this.isDead || this.hasWon) break;

      // Always maintain constant forward movement
      this.rb.velocity.x = this.moveSpeed;

      // Apply sub-step gravity
      this.rb.velocity.y += this.rb.gravity * subDt;

      // Capture pre-substep state
      const subOldX = this.transform.position.x;
      const subOldY = this.transform.position.y;

      const targetX = subOldX + this.rb.velocity.x * subDt;
      const targetY = subOldY + this.rb.velocity.y * subDt;

      // Continuous swept bounding box spanning from start to target position for this sub-step segment
      const sweptBounds = {
        minX: Math.min(subOldX, targetX),
        maxX: Math.max(subOldX, targetX) + this.size,
        minY: Math.min(subOldY, targetY),
        maxY: Math.max(subOldY, targetY) + this.size,
        width: Math.abs(targetX - subOldX) + this.size,
        height: Math.abs(targetY - subOldY) + this.size,
        centerX: (Math.min(subOldX, targetX) + Math.max(subOldX, targetX) + this.size) / 2,
        centerY: (Math.min(subOldY, targetY) + Math.max(subOldY, targetY) + this.size) / 2,
      };

      // 1. Spikes Continuous Collision Detection (Instant Death with triangular precision)
      for (const spike of spikes) {
        if (spike.checkTriangleCollision(sweptBounds)) {
          this.die();
          return;
        }
      }

      // 2. Goal Continuous Collision Detection (Instant Win)
      const goalBounds = goal.collider.getBounds(goal.transform);
      if (BoxCollider.checkAABB(sweptBounds, goalBounds)) {
        this.win();
        return;
      }

      // 3. Platform & Ground Obstacle Wall / Ceiling Collision Checks
      // Check for horizontal wall crashes into ground cliff faces
      for (const g of groundSections) {
        const gBounds = g.collider.getBounds(g.transform);
        if (
          subOldX + this.size <= gBounds.minX + 4 &&
          targetX + this.size >= gBounds.minX &&
          targetY + this.size > gBounds.minY + 6 &&
          targetY < gBounds.maxY
        ) {
          this.die();
          return;
        }
      }

      // Check for wall and ceiling crashes into solid platforms
      for (const platform of platforms) {
        const platBounds = platform.collider.getBounds(platform.transform);

        // A. Wall crash into left vertical face
        const hitLeftWall =
          subOldX + this.size <= platBounds.minX + 4 &&
          targetX + this.size >= platBounds.minX &&
          targetY + this.size > platBounds.minY + 6 &&
          targetY < platBounds.maxY - 2;

        // B. Ceiling crash (head bump) from jumping upward into bottom
        const hitCeiling =
          this.rb.velocity.y < 0 &&
          subOldY >= platBounds.maxY - 6 &&
          targetY <= platBounds.maxY &&
          targetX + this.size > platBounds.minX + 4 &&
          targetX < platBounds.maxX - 4;

        if (hitLeftWall || hitCeiling) {
          this.die();
          return;
        }
      }

      // 4. Update Position for current sub-step
      this.transform.position.x = targetX;
      this.transform.position.y = targetY;
      const currentBounds = this.collider.getBounds(this.transform);

      // 5. Ground Top Landing Resolution
      for (const g of groundSections) {
        const gBounds = g.collider.getBounds(g.transform);
        if (
          currentBounds.maxX > gBounds.minX &&
          currentBounds.minX < gBounds.maxX
        ) {
          if (
            this.rb.velocity.y >= 0 &&
            currentBounds.maxY >= gBounds.minY &&
            subOldY + this.size <= gBounds.minY + 12
          ) {
            this.transform.position.y = gBounds.minY - this.size;
            this.rb.velocity.y = 0;
            this.isGrounded = true;
          }
        }
      }

      // 6. Platform Top Landing Resolution
      for (const platform of platforms) {
        const platBounds = platform.collider.getBounds(platform.transform);
        if (
          currentBounds.maxX > platBounds.minX + 4 &&
          currentBounds.minX < platBounds.maxX - 4
        ) {
          if (
            this.rb.velocity.y >= 0 &&
            currentBounds.maxY >= platBounds.minY &&
            subOldY + this.size <= platBounds.minY + 12
          ) {
            this.transform.position.y = platBounds.minY - this.size;
            this.rb.velocity.y = 0;
            this.isGrounded = true;
          }
        }
      }

      // 7. Bottom void fall check
      if (this.transform.position.y > 580) {
        this.die();
        return;
      }
    }

    // Start coyote timer on leaving ground
    if (wasGrounded && !this.isGrounded && this.rb.velocity.y >= 0) {
      this.coyoteTimer = this.coyoteWindow;
    }

    // Spawn landing dust and initiate landing squash on initial touch down
    if (!wasGrounded && this.isGrounded) {
      this.squash = 0.16;
      SoundManager.getInstance().playLand();
      const bx = this.transform.position.x + this.size / 2;
      const by = this.transform.position.y + this.size;
      for (let i = 0; i < 4; i++) {
        this.particles.push({
          x: bx + (Math.random() - 0.5) * 16,
          y: by,
          vx: (Math.random() - 0.5) * 60,
          vy: -15 - Math.random() * 20,
          size: 2.5 + Math.random() * 2.5,
          alpha: 0.6,
          decay: 4.0,
          color: '#00E5FF',
        });
      }
    }

    // Decay landing squash smoothly
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - 5.0 * fixedDeltaTime);
    }

    // Rotation update: smooth spin in midair, smooth easing to nearest quadrant when grounded
    if (!this.isGrounded) {
      this.visualRotation += 7.5 * fixedDeltaTime;
    } else {
      // Find nearest 90-degree quadrant
      const snapTarget = Math.round(this.visualRotation / (Math.PI / 2)) * (Math.PI / 2);
      const diff = snapTarget - this.visualRotation;
      if (Math.abs(diff) < 0.015) {
        this.visualRotation = snapTarget;
      } else {
        // Fast, continuous dampening to eliminate visible 1-frame optical jerk
        this.visualRotation += diff * Math.min(1, 24 * fixedDeltaTime);
      }
    }
    this.transform.rotation = this.visualRotation;

    // Trail ghost update
    this.trailTimer += fixedDeltaTime;
    if (this.trailTimer > 0.04) {
      this.trailTimer = 0;
      this.trails.push({
        x: this.transform.position.x,
        y: this.transform.position.y,
        rotation: this.visualRotation,
        alpha: 0.35,
      });
      if (this.trails.length > 5) {
        this.trails.shift();
      }
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].alpha -= 3.0 * fixedDeltaTime;
      if (this.trails[i].alpha <= 0) {
        this.trails.splice(i, 1);
      }
    }
  }

  /**
   * Renders the player cube, trails, and particles.
   */
  public render(renderer: CanvasRenderer): void {
    // Get current skin styling
    const skin: SkinData = GameStateManager.getInstance().getEquippedSkin();

    // 1. Render ghost trails
    for (const trail of this.trails) {
      const tcx = trail.x + this.size / 2;
      const tcy = trail.y + this.size / 2;
      renderer.drawRect(tcx, tcy, this.size, this.size, {
        fill: skin.trailColor,
        stroke: skin.trailGlow,
        lineWidth: 1,
        rotation: trail.rotation,
        centerOrigin: true,
      });
    }

    // 2. Render particles
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.alpha));
      renderer.drawRect(p.x, p.y, p.size, p.size, {
        fill: p.color || skin.primaryColor,
        centerOrigin: true,
      });
    }

    if (this.isDead) return;

    // Calculate dimensions with grounded squash & stretch
    const currentSquash = this.isGrounded ? this.squash : 0;
    const renderWidth = this.size * (1 + currentSquash * 0.6);
    const renderHeight = this.size * (1 - currentSquash * 0.6);

    // Anchor bottom contact edge firmly to ground
    const bottomY = this.transform.position.y + this.size;
    const cx = this.transform.position.x + this.size / 2;
    const cy = bottomY - renderHeight / 2;

    // 3. Main Player Body: Primary Skin Color
    renderer.drawRect(cx, cy, renderWidth, renderHeight, {
      fill: skin.primaryColor,
      stroke: skin.strokeColor,
      lineWidth: 2,
      rotation: this.transform.rotation,
      centerOrigin: true,
    });

    // 4. Inner geometric core for crisp high-tech aesthetic
    const innerWidth = renderWidth * 0.48;
    const innerHeight = renderHeight * 0.48;
    renderer.drawRect(cx, cy, innerWidth, innerHeight, {
      fill: skin.coreColor,
      stroke: skin.coreStrokeColor,
      lineWidth: 1.5,
      rotation: this.transform.rotation,
      centerOrigin: true,
    });
  }
}
