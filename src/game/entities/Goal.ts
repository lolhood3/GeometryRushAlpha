import { Transform } from '../../engine/core/Transform.ts';
import { BoxCollider } from '../../engine/physics/BoxCollider.ts';
import { Vector2 } from '../../engine/utils/Vector2.ts';
import type { CanvasRenderer } from '../../engine/graphics/CanvasRenderer.ts';

export interface GoalOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * Goal / Finish gate entity in Rush Engine.
 * Features vibrant bright green (#00FF88) styling, radiant beacon towers, and geometric gate markers.
 */
export class Goal {
  public readonly transform: Transform;
  public readonly collider: BoxCollider;
  public readonly width: number;
  public readonly height: number;

  constructor(options: GoalOptions) {
    this.width = options.width ?? 44;
    this.height = options.height ?? 90;

    this.transform = new Transform(new Vector2(options.x, options.y));
    this.collider = new BoxCollider({
      width: this.width,
      height: this.height,
      isTrigger: true,
    });
  }

  public render(renderer: CanvasRenderer): void {
    const x = this.transform.position.x;
    const y = this.transform.position.y;
    const w = this.width;
    const h = this.height;

    // Glowing outer aura pill
    renderer.drawRect(x - 4, y - 4, w + 8, h + 8, {
      fill: 'rgba(0, 255, 136, 0.15)',
    });

    // Main Bright Green (#00FF88) Goal Block
    renderer.drawRect(x, y, w, h, {
      fill: '#00FF88',
      stroke: '#FFFFFF',
      lineWidth: 2,
    });

    // Inner geometric energy columns
    const colW = (w - 16) / 2;
    renderer.drawRect(x + 5, y + 6, colW, h - 12, {
      fill: '#059669',
      stroke: '#34D399',
      lineWidth: 1.5,
    });
    renderer.drawRect(x + 11 + colW, y + 6, colW, h - 12, {
      fill: '#059669',
      stroke: '#34D399',
      lineWidth: 1.5,
    });

    // Vertical top beacon beam
    renderer.drawLine(x + w / 2, y - 60, x + w / 2, y, {
      stroke: 'rgba(0, 255, 136, 0.8)',
      lineWidth: 3,
    });
  }
}
