import { Vector2 } from '../utils/Vector2.ts';

/**
 * Spatial transformation component defining an entity's position, rotation, and scale in 2D space.
 * Follows Rush Engine's zero-overhead component conventions.
 */
export class Transform {
  public position: Vector2;
  /**
   * Rotation in radians.
   */
  public rotation: number;
  public scale: Vector2;

  constructor(
    position: Vector2 = new Vector2(0, 0),
    rotation: number = 0,
    scale: Vector2 = new Vector2(1, 1)
  ) {
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
  }

  /**
   * Rotation angle represented in degrees.
   */
  public get rotationDegrees(): number {
    return (this.rotation * 180) / Math.PI;
  }

  public set rotationDegrees(deg: number) {
    this.rotation = (deg * Math.PI) / 180;
  }

  /**
   * Translates position by delta coordinates.
   */
  public translate(dx: number, dy: number): this;
  public translate(delta: Vector2): this;
  public translate(dxOrDelta: number | Vector2, dy?: number): this {
    if (typeof dxOrDelta === 'number') {
      this.position.x += dxOrDelta;
      this.position.y += dy ?? 0;
    } else {
      this.position.x += dxOrDelta.x;
      this.position.y += dxOrDelta.y;
    }
    return this;
  }

  /**
   * Rotates by an angle in radians.
   */
  public rotate(radians: number): this {
    this.rotation += radians;
    return this;
  }

  /**
   * Rotates by an angle in degrees.
   */
  public rotateDegrees(degrees: number): this {
    this.rotation += (degrees * Math.PI) / 180;
    return this;
  }

  /**
   * Sets position coordinates.
   */
  public setPosition(x: number, y: number): this {
    this.position.x = x;
    this.position.y = y;
    return this;
  }

  /**
   * Sets scale factors.
   */
  public setScale(x: number, y: number): this {
    this.scale.x = x;
    this.scale.y = y;
    return this;
  }

  /**
   * Sets uniform scale.
   */
  public setUniformScale(s: number): this {
    this.scale.x = s;
    this.scale.y = s;
    return this;
  }

  /**
   * Sets all transform properties at once.
   */
  public set(
    x: number,
    y: number,
    rotation: number = 0,
    scaleX: number = 1,
    scaleY: number = 1
  ): this {
    this.position.x = x;
    this.position.y = y;
    this.rotation = rotation;
    this.scale.x = scaleX;
    this.scale.y = scaleY;
    return this;
  }

  /**
   * Copies transformation values from another Transform instance.
   */
  public copyFrom(other: Transform): this {
    this.position.x = other.position.x;
    this.position.y = other.position.y;
    this.rotation = other.rotation;
    this.scale.x = other.scale.x;
    this.scale.y = other.scale.y;
    return this;
  }

  /**
   * Creates an independent clone of this Transform.
   */
  public clone(): Transform {
    return new Transform(
      this.position.clone(),
      this.rotation,
      this.scale.clone()
    );
  }

  /**
   * Resets transform to default origin and unit scale.
   */
  public reset(): this {
    this.position.set(0, 0);
    this.rotation = 0;
    this.scale.set(1, 1);
    return this;
  }
}
