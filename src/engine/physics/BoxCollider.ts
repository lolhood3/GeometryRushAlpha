import { Vector2 } from '../utils/Vector2.ts';
import type { Transform } from '../core/Transform.ts';

/**
 * Axis-Aligned Bounding Box representation in 2D world space.
 */
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface BoxColliderOptions {
  width?: number;
  height?: number;
  offset?: Vector2;
  isTrigger?: boolean;
}

/**
 * Simple Axis-Aligned Bounding Box (AABB) collider component.
 * Provides lightweight, fast collision detection without SAT or heavy physics solver overhead.
 */
export class BoxCollider {
  public size: Vector2;
  public offset: Vector2;
  public isTrigger: boolean;

  constructor(options: BoxColliderOptions = {}) {
    this.size = new Vector2(options.width ?? 32, options.height ?? 32);
    this.offset = options.offset ? options.offset.clone() : new Vector2(0, 0);
    this.isTrigger = options.isTrigger ?? false;
  }

  /**
   * Computes the world-space Axis-Aligned Bounding Box given an optional transform.
   */
  public getBounds(transform?: Transform): AABB {
    const posX = (transform ? transform.position.x : 0) + this.offset.x;
    const posY = (transform ? transform.position.y : 0) + this.offset.y;
    const scaleX = transform ? Math.abs(transform.scale.x) : 1;
    const scaleY = transform ? Math.abs(transform.scale.y) : 1;

    const width = this.size.x * scaleX;
    const height = this.size.y * scaleY;

    return {
      minX: posX,
      minY: posY,
      maxX: posX + width,
      maxY: posY + height,
      width,
      height,
      centerX: posX + width / 2,
      centerY: posY + height / 2,
    };
  }

  /**
   * Checks if this collider intersects with another BoxCollider.
   */
  public intersects(
    other: BoxCollider,
    thisTransform?: Transform,
    otherTransform?: Transform
  ): boolean {
    const a = this.getBounds(thisTransform);
    const b = other.getBounds(otherTransform);
    return BoxCollider.checkAABB(a, b);
  }

  /**
   * Checks if this collider intersects with a given AABB directly.
   */
  public intersectsAABB(otherBounds: AABB, thisTransform?: Transform): boolean {
    const a = this.getBounds(thisTransform);
    return BoxCollider.checkAABB(a, otherBounds);
  }

  /**
   * Static Axis-Aligned Bounding Box overlap test.
   */
  public static checkAABB(a: AABB, b: AABB): boolean {
    return (
      a.minX < b.maxX &&
      a.maxX > b.minX &&
      a.minY < b.maxY &&
      a.maxY > b.minY
    );
  }

  /**
   * Checks if a 2D world point is inside the given AABB bounds.
   */
  public static containsPoint(bounds: AABB, pointX: number, pointY: number): boolean {
    return (
      pointX >= bounds.minX &&
      pointX <= bounds.maxX &&
      pointY >= bounds.minY &&
      pointY <= bounds.maxY
    );
  }

  /**
   * Sets collider size dimensions.
   */
  public setSize(width: number, height: number): this {
    this.size.x = width;
    this.size.y = height;
    return this;
  }

  /**
   * Sets local offset relative to transform position.
   */
  public setOffset(x: number, y: number): this {
    this.offset.x = x;
    this.offset.y = y;
    return this;
  }
}
