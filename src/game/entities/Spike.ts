import { Transform } from '../../engine/core/Transform.ts';
import { BoxCollider, type AABB } from '../../engine/physics/BoxCollider.ts';
import { Vector2 } from '../../engine/utils/Vector2.ts';
import type { CanvasRenderer } from '../../engine/graphics/CanvasRenderer.ts';

export interface SpikeOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * Hazard spike entity for Rush Engine.
 * Styled in bright red (#FF3B3B) with high-contrast outlines and pixel-precise geometry.
 */
export class Spike {
  public readonly transform: Transform;
  public readonly collider: BoxCollider;
  public readonly width: number;
  public readonly height: number;

  constructor(options: SpikeOptions) {
    this.width = options.width ?? 28;
    this.height = options.height ?? 30;

    this.transform = new Transform(new Vector2(options.x, options.y));
    this.collider = new BoxCollider({
      width: this.width,
      height: this.height,
    });
  }

  /**
   * Returns fair hazard bounds (slightly tucked in from the outer tip/edges)
   * to ensure fair hit registration.
   */
  public getHazardBounds(): AABB {
    const raw = this.collider.getBounds(this.transform);
    const paddingX = 4;
    const paddingTop = 4;

    return {
      minX: raw.minX + paddingX,
      maxX: raw.maxX - paddingX,
      minY: raw.minY + paddingTop,
      maxY: raw.maxY,
      width: raw.width - paddingX * 2,
      height: raw.height - paddingTop,
      centerX: raw.centerX,
      centerY: raw.centerY,
    };
  }

  /**
   * Performs pixel-fair triangular hazard collision detection against an AABB.
   * Tests actual intersection between the player AABB and the isosceles spike triangle.
   * Includes generous safety padding around the tip and base to completely prevent ghost deaths.
   */
  public checkTriangleCollision(bounds: AABB): boolean {
    const x = this.transform.position.x;
    const y = this.transform.position.y;
    const w = this.width;
    const h = this.height;

    // Safety margins: 6px tip reduction, 4px base margin, and 3px vertical floor buffer
    const tipPadding = 6;
    const basePadding = 4;
    const floorPadding = 2;

    const spikeTopY = y + tipPadding;
    const spikeBottomY = y + h - floorPadding;

    // 1. Broad-phase vertical overlap test
    if (bounds.maxY <= spikeTopY || bounds.minY >= spikeBottomY) {
      return false;
    }

    // 2. Broad-phase horizontal overlap test with base
    const spikeLeftBase = x + basePadding;
    const spikeRightBase = x + w - basePadding;
    if (bounds.maxX <= spikeLeftBase || bounds.minX >= spikeRightBase) {
      return false;
    }

    // 3. Narrow-phase triangular slope test
    // Evaluate the horizontal span of the spike at the player's bottom edge (or bottom of spike)
    const evalY = Math.min(bounds.maxY, spikeBottomY);
    const progress = Math.max(0, Math.min(1, (evalY - spikeTopY) / (spikeBottomY - spikeTopY)));

    const maxHalfWidth = (w - basePadding * 2) / 2;
    const halfWidthAtY = maxHalfWidth * progress;
    const centerX = x + w / 2;

    const leftAtY = centerX - halfWidthAtY;
    const rightAtY = centerX + halfWidthAtY;

    // Strict intersection with the triangle slice: player's right edge must pass the left slope
    // and player's left edge must pass the right slope with at least 1px penetration
    return bounds.maxX > leftAtY + 1 && bounds.minX < rightAtY - 1;
  }

  public render(renderer: CanvasRenderer): void {
    const x = this.transform.position.x;
    const y = this.transform.position.y;
    const w = this.width;
    const h = this.height;

    // Render dense solid bright red (#FF3B3B) fill
    const step = 2;
    for (let i = 0; i <= w; i += step) {
      const progress = i < w / 2 ? i / (w / 2) : (w - i) / (w / 2);
      const currentHeight = h * progress;
      renderer.drawLine(x + i, y + h, x + i, y + h - currentHeight, {
        stroke: '#FF3B3B',
        lineWidth: step + 0.5,
      });
    }

    // Inner bright center spike core (#FFA3A3)
    const innerW = w * 0.4;
    const innerH = h * 0.5;
    const innerStartX = x + (w - innerW) / 2;
    for (let i = 0; i <= innerW; i += 2) {
      const progress = i < innerW / 2 ? i / (innerW / 2) : (innerW - i) / (innerW / 2);
      const currentHeight = innerH * progress;
      renderer.drawLine(
        innerStartX + i,
        y + h - 2,
        innerStartX + i,
        y + h - 2 - currentHeight,
        {
          stroke: '#FFA3A3',
          lineWidth: 2,
        }
      );
    }

    // High-contrast outer stroke edges (#DC2626)
    renderer.drawLine(x, y + h, x + w / 2, y, {
      stroke: '#DC2626',
      lineWidth: 2,
    });
    renderer.drawLine(x + w / 2, y, x + w, y + h, {
      stroke: '#DC2626',
      lineWidth: 2,
    });
    renderer.drawLine(x, y + h, x + w, y + h, {
      stroke: '#DC2626',
      lineWidth: 2,
    });
  }
}
