import { Transform } from '../../engine/core/Transform.ts';
import { BoxCollider } from '../../engine/physics/BoxCollider.ts';
import { Vector2 } from '../../engine/utils/Vector2.ts';
import type { CanvasRenderer } from '../../engine/graphics/CanvasRenderer.ts';

export interface PlatformOptions {
  x: number;
  y: number;
  width: number;
  height?: number;
}

/**
 * Platform entity for elevated surfaces.
 * Styled in dark gray (#2D3748) with high-contrast outlines and top rail indicators.
 */
export class Platform {
  public readonly transform: Transform;
  public readonly collider: BoxCollider;
  public readonly width: number;
  public readonly height: number;

  constructor(options: PlatformOptions) {
    this.width = options.width;
    this.height = options.height ?? 20;

    this.transform = new Transform(new Vector2(options.x, options.y));
    this.collider = new BoxCollider({
      width: this.width,
      height: this.height,
    });
  }

  public render(renderer: CanvasRenderer): void {
    const x = this.transform.position.x;
    const y = this.transform.position.y;
    const w = this.width;
    const h = this.height;

    // Platform solid body (#2D3748)
    renderer.drawRect(x, y, w, h, {
      fill: '#2D3748',
      stroke: '#4A5568',
      lineWidth: 1.5,
    });

    // Top surface high-visibility edge (#E2E8F0)
    renderer.drawLine(x, y, x + w, y, {
      stroke: '#E2E8F0',
      lineWidth: 2.5,
    });

    // Inner subtle chamfer accents
    renderer.drawRect(x + 3, y + 4, w - 6, h - 8, {
      fill: '#1A202C',
      stroke: '#374151',
      lineWidth: 1,
    });
  }
}
