import { Transform } from '../../engine/core/Transform.ts';
import { BoxCollider } from '../../engine/physics/BoxCollider.ts';
import { Vector2 } from '../../engine/utils/Vector2.ts';
import type { CanvasRenderer } from '../../engine/graphics/CanvasRenderer.ts';

export interface GroundSectionOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Ground entity representing walkable surfaces in Rush Engine.
 * Features dark gray styling (#2D3748), high-contrast top rail outline (#4A5568),
 * and subtle geometric hash marks for speed sensation.
 */
export class Ground {
  public readonly transform: Transform;
  public readonly collider: BoxCollider;
  public readonly width: number;
  public readonly height: number;

  constructor(options: GroundSectionOptions) {
    this.width = options.width;
    this.height = options.height;

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

    // Dark gray ground fill (#2D3748)
    renderer.drawRect(x, y, w, h, {
      fill: '#2D3748',
    });

    // Top surface line (#4A5568 / #718096)
    renderer.drawLine(x, y, x + w, y, {
      stroke: '#718096',
      lineWidth: 3,
    });

    // Subtle decorative grid ticks along ground top for speed visual feedback
    const tickSpacing = 60;
    const firstTick = Math.ceil(x / tickSpacing) * tickSpacing;
    for (let tx = firstTick; tx < x + w; tx += tickSpacing) {
      renderer.drawLine(tx, y, tx, y + 8, {
        stroke: '#4A5568',
        lineWidth: 2,
      });
    }
  }
}
