import type { Engine } from '../../engine/core/Engine.ts';
import type { CanvasRenderer } from '../../engine/graphics/CanvasRenderer.ts';
import type { IScene } from '../../engine/scene/IScene.ts';
import { Logger } from '../../engine/utils/Logger.ts';

/**
 * Baseline initial scene representing a clean, empty canvas environment in Rush Engine.
 * Serves as the default template for scenes to be constructed in future prompts.
 */
export class EmptyScene implements IScene {
  public readonly name: string = 'EmptyScene';
  private engine: Engine | null = null;

  public init(engine: Engine): void {
    this.engine = engine;
    Logger.info(this.name, 'Scene initialized.');
  }

  public onEnter(): void {
    Logger.info(this.name, 'Scene entered.');
  }

  public onExit(): void {
    Logger.info(this.name, 'Scene exited.');
  }

  public fixedUpdate(_fixedDelta: number): void {
    // Fixed simulation tick (deterministic physics / game state integration)
    // Intentionally blank foundation ready for future gameplay mechanics
  }

  public update(_delta: number): void {
    // Variable simulation tick (frame animations / camera / effects)
  }

  public render(renderer: CanvasRenderer, _alpha: number): void {
    // Baseline clean render: Canvas is cleared to pure black (#000000) by the renderer
    renderer.clear('#000000');
  }

  public destroy(): void {
    this.engine = null;
    Logger.info(this.name, 'Scene destroyed.');
  }
}
