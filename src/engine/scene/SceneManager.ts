import type { Engine } from '../core/Engine.ts';
import type { CanvasRenderer } from '../graphics/CanvasRenderer.ts';
import { Logger } from '../utils/Logger.ts';
import type { IScene } from './IScene.ts';

/**
 * Manages scene registration, lifecycle transitions, and loop delegation for Rush Engine.
 */
export class SceneManager {
  private readonly engine: Engine;
  private readonly scenes: Map<string, IScene> = new Map();
  private activeScene: IScene | null = null;
  private pendingScene: IScene | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  /**
   * Returns the currently active scene.
   */
  public get currentScene(): IScene | null {
    return this.activeScene;
  }

  /**
   * Registers a scene with the manager.
   * @param scene Scene instance implementing IScene.
   */
  public register(scene: IScene): this {
    if (this.scenes.has(scene.name)) {
      Logger.warn('SceneManager', `Scene "${scene.name}" is already registered. Overwriting.`);
    }
    this.scenes.set(scene.name, scene);
    try {
      const initResult = scene.init(this.engine);
      if (initResult instanceof Promise) {
        initResult.catch((error) => {
          Logger.error('SceneManager', `Async init failed for scene "${scene.name}":`, error);
        });
      }
    } catch (error) {
      Logger.error('SceneManager', `Synchronous init error in scene "${scene.name}":`, error);
    }
    return this;
  }

  /**
   * Switches to a registered scene by name or directly to a scene instance.
   * Transition occurs safely at the start of the next frame cycle.
   */
  public switchScene(sceneOrName: string | IScene): void {
    let targetScene: IScene | undefined;

    if (typeof sceneOrName === 'string') {
      targetScene = this.scenes.get(sceneOrName);
      if (!targetScene) {
        Logger.error('SceneManager', `Cannot switch to unknown scene "${sceneOrName}"`);
        return;
      }
    } else {
      targetScene = sceneOrName;
      if (!this.scenes.has(targetScene.name)) {
        this.register(targetScene);
      }
    }

    this.pendingScene = targetScene;
    this.processSceneTransition();
  }

  /**
   * Executes the transition from the active scene to the pending scene.
   */
  private processSceneTransition(): void {
    if (!this.pendingScene) return;

    if (this.activeScene) {
      Logger.info('SceneManager', `Exiting scene "${this.activeScene.name}"`);
      this.activeScene.onExit();
    }

    this.activeScene = this.pendingScene;
    this.pendingScene = null;

    Logger.info('SceneManager', `Entering scene "${this.activeScene.name}"`);
    this.activeScene.onEnter();
  }

  /**
   * Dispatches fixed update to the active scene.
   */
  public fixedUpdate(fixedDelta: number): void {
    if (this.activeScene) {
      this.activeScene.fixedUpdate(fixedDelta);
    }
  }

  /**
   * Dispatches variable update to the active scene.
   */
  public update(delta: number): void {
    if (this.activeScene) {
      this.activeScene.update(delta);
    }
  }

  /**
   * Dispatches render call to the active scene.
   */
  public render(renderer: CanvasRenderer, alpha: number): void {
    if (this.activeScene) {
      this.activeScene.render(renderer, alpha);
    }
  }

  /**
   * Cleans up all scenes and active state.
   */
  public destroy(): void {
    if (this.activeScene) {
      this.activeScene.onExit();
      this.activeScene = null;
    }

    for (const scene of this.scenes.values()) {
      scene.destroy();
    }
    this.scenes.clear();
  }
}
