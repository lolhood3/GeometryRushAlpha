import { MathUtils } from './MathUtils.ts';

/**
 * Represents a 2D vector with common geometric and algebraic operations for Rush Engine.
 */
export class Vector2 {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  public static get ZERO(): Vector2 { return new Vector2(0, 0); }
  public static get ONE(): Vector2 { return new Vector2(1, 1); }
  public static get UP(): Vector2 { return new Vector2(0, -1); }
  public static get DOWN(): Vector2 { return new Vector2(0, 1); }
  public static get LEFT(): Vector2 { return new Vector2(-1, 0); }
  public static get RIGHT(): Vector2 { return new Vector2(1, 0); }

  public static zero(): Vector2 { return new Vector2(0, 0); }
  public static one(): Vector2 { return new Vector2(1, 1); }
  public static up(): Vector2 { return new Vector2(0, -1); }
  public static down(): Vector2 { return new Vector2(0, 1); }
  public static left(): Vector2 { return new Vector2(-1, 0); }
  public static right(): Vector2 { return new Vector2(1, 0); }

  public set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  public copy(other: Vector2): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  public clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  public add(other: Vector2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  public subtract(other: Vector2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  public multiply(other: Vector2): this {
    this.x *= other.x;
    this.y *= other.y;
    return this;
  }

  public scale(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  public dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  public lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  public length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  public distanceTo(other: Vector2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public normalize(): this {
    const len = this.length();
    if (len > 0.00001) {
      this.x /= len;
      this.y /= len;
    } else {
      this.x = 0;
      this.y = 0;
    }
    return this;
  }

  public lerp(target: Vector2, alpha: number): this {
    this.x = MathUtils.lerp(this.x, target.x, alpha);
    this.y = MathUtils.lerp(this.y, target.y, alpha);
    return this;
  }

  public equals(other: Vector2, epsilon: number = 0.00001): boolean {
    return MathUtils.approximately(this.x, other.x, epsilon) &&
           MathUtils.approximately(this.y, other.y, epsilon);
  }
}
