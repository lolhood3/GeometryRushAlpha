import { Vector2 } from '../utils/Vector2.ts';
import type { Transform } from '../core/Transform.ts';

export interface Rigidbody2DOptions {
  velocity?: Vector2;
  gravity?: number;
  acceleration?: Vector2;
  useGravity?: boolean;
  mass?: number;
  isKinematic?: boolean;
}

/**
 * Lightweight 2D kinematic and dynamic physics body component for Rush Engine.
 * Handles linear velocity, gravity, acceleration, and deterministic Euler integration.
 */
export class Rigidbody2D {
  public velocity: Vector2;
  /**
   * Downward gravitational acceleration in pixels/s².
   */
  public gravity: number;
  public acceleration: Vector2;
  public useGravity: boolean;
  public mass: number;
  public isKinematic: boolean;

  constructor(options: Rigidbody2DOptions = {}) {
    this.velocity = options.velocity ? options.velocity.clone() : new Vector2(0, 0);
    this.gravity = options.gravity ?? 980; // Standard 2D gravity constant (980 px/s²)
    this.acceleration = options.acceleration ? options.acceleration.clone() : new Vector2(0, 0);
    this.useGravity = options.useGravity ?? true;
    this.mass = Math.max(0.0001, options.mass ?? 1.0);
    this.isKinematic = options.isKinematic ?? false;
  }

  /**
   * Advances velocity and position integration by the fixed timestep.
   * @param fixedDeltaTime Deterministic fixed timestep in seconds.
   * @param transform Optional transform component to move with computed velocity.
   */
  public update(fixedDeltaTime: number, transform?: Transform): void {
    if (this.isKinematic) {
      if (transform) {
        transform.position.x += this.velocity.x * fixedDeltaTime;
        transform.position.y += this.velocity.y * fixedDeltaTime;
      }
      return;
    }

    // Apply linear acceleration
    this.velocity.x += this.acceleration.x * fixedDeltaTime;
    this.velocity.y += this.acceleration.y * fixedDeltaTime;

    // Apply gravity
    if (this.useGravity) {
      this.velocity.y += this.gravity * fixedDeltaTime;
    }

    // Integrate position on target transform
    if (transform) {
      transform.position.x += this.velocity.x * fixedDeltaTime;
      transform.position.y += this.velocity.y * fixedDeltaTime;
    }
  }

  /**
   * Adds continuous force (divided by mass to produce acceleration).
   */
  public addForce(fx: number, fy: number): void;
  public addForce(force: Vector2): void;
  public addForce(fxOrForce: number | Vector2, fy?: number): void {
    const invMass = 1 / this.mass;
    if (typeof fxOrForce === 'number') {
      this.acceleration.x += fxOrForce * invMass;
      this.acceleration.y += (fy ?? 0) * invMass;
    } else {
      this.acceleration.x += fxOrForce.x * invMass;
      this.acceleration.y += fxOrForce.y * invMass;
    }
  }

  /**
   * Adds an instantaneous velocity impulse.
   */
  public addImpulse(ix: number, iy: number): void;
  public addImpulse(impulse: Vector2): void;
  public addImpulse(ixOrImpulse: number | Vector2, iy?: number): void {
    if (typeof ixOrImpulse === 'number') {
      this.velocity.x += ixOrImpulse;
      this.velocity.y += iy ?? 0;
    } else {
      this.velocity.x += ixOrImpulse.x;
      this.velocity.y += ixOrImpulse.y;
    }
  }

  /**
   * Sets velocity vector coordinates.
   */
  public setVelocity(vx: number, vy: number): this {
    this.velocity.x = vx;
    this.velocity.y = vy;
    return this;
  }

  /**
   * Sets acceleration vector coordinates.
   */
  public setAcceleration(ax: number, ay: number): this {
    this.acceleration.x = ax;
    this.acceleration.y = ay;
    return this;
  }

  /**
   * Resets current velocity to zero.
   */
  public resetVelocity(): this {
    this.velocity.set(0, 0);
    return this;
  }

  /**
   * Resets current acceleration to zero.
   */
  public resetAcceleration(): this {
    this.acceleration.set(0, 0);
    return this;
  }

  /**
   * Resets both velocity and acceleration.
   */
  public reset(): this {
    this.resetVelocity();
    this.resetAcceleration();
    return this;
  }
}
