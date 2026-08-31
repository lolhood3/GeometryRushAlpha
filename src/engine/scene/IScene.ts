import type { Engine } from '../core/Engine.ts';
import type { CanvasRenderer } from '../graphics/CanvasRenderer.ts';

/**
 * Interface that all game scenes (menus, levels, transitions) must implement.
 */
export interface IScene {
  /**
   * Unique identifier name for the scene.
   */
  readonly name: string;

  /**
   * Called when the scene is first registered or initialized with the engine.
   * @param engine Reference to the parent Engine instance.
   */
  init(engine: Engine): void | Promise<void>;

  /**
   * Called when this scene becomes the active foreground scene.
   */
  onEnter(): void;

  /**
   * Called when this scene is transitioned away from or replaced.
   */
  onExit(): void;

  /**
   * Called at a constant, deterministic fixed timestep.
   * Ideal for physics simulation, velocity integration, and state machines.
   * @param fixedDelta Time step in seconds (e.g., 1/60s).
   */
  fixedUpdate(fixedDelta: number): void;

  /**
   * Called once per frame with the variable frame delta time.
   * Ideal for animations, camera panning, and input handling.
   * @param delta Variable delta time in seconds.
   */
  update(delta: number): void;

  /**
   * Called once per frame to draw scene graphics.
   * @param renderer The CanvasRenderer instance.
   * @param alpha Interpolation factor between the previous and current fixed state [0, 1].
   */
  render(renderer: CanvasRenderer, alpha: number): void;

  /**
   * Called when the scene is destroyed to release any allocated resources.
   */
  destroy(): void;
}
