import { CanvasManager, type CanvasManagerOptions, type CanvasResizeEvent } from '../graphics/CanvasManager.ts';
import { CanvasRenderer, type CanvasRendererOptions } from '../graphics/CanvasRenderer.ts';
import { SceneManager } from '../scene/SceneManager.ts';
import type { IScene } from '../scene/IScene.ts';
import { InputManager, type InputManagerOptions } from '../input/index.ts';
import { EventEmitter } from './EventEmitter.ts';
import { GameLoop, type GameLoopOptions } from './GameLoop.ts';
import { Time } from './Time.ts';
import { Logger } from '../utils/Logger.ts';

export interface EngineEvents {
  start: void;
  stop: void;
  pause: void;
  resume: void;
  resize: CanvasResizeEvent;
  [key: string]: unknown;
}

export interface EngineConfig {
  /**
   * Target HTML5 Canvas DOM element.
   */
  canvas: HTMLCanvasElement;

  /**
   * Initial active scene or array of scenes to register.
   */
  initialScene?: IScene;

  /**
   * Canvas manager configuration (auto-resize, high-DPI max ratio, etc.).
   */
  canvasOptions?: CanvasManagerOptions;

  /**
   * Canvas renderer configuration (clear color, etc.).
   */
  rendererOptions?: CanvasRendererOptions;

  /**
   * Game loop simulation configuration (fixed timestep, clamp).
   */
  loopOptions?: GameLoopOptions;

  /**
   * Keyboard and controller input configuration.
   */
  inputOptions?: InputManagerOptions;
}

/**
 * The central Rush Engine facade orchestrating the core subsystems:
 * GameLoop, Time, CanvasManager, CanvasRenderer, InputManager, SceneManager, and EventBus.
 */
export class Engine {
  public static currentInstance: Engine | null = null;

  public readonly canvas: HTMLCanvasElement;
  public readonly context: CanvasRenderingContext2D;
  public readonly events: EventEmitter<EngineEvents>;
  public readonly time: Time;
  public readonly canvasManager: CanvasManager;
  public readonly renderer: CanvasRenderer;
  public readonly input: InputManager;
  public readonly sceneManager: SceneManager;
  public readonly loop: GameLoop;

  private isInitialized: boolean = false;
  private isDestroyed: boolean = false;

  private constructor(config: EngineConfig) {
    this.canvas = config.canvas;
    
    // Acquire 2D context with optimized alpha/desynchronized settings and fallback
    let ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (!ctx) {
      // Fallback for standard 2D context without desynchronized hints
      ctx = this.canvas.getContext('2d');
    }

    if (!ctx) {
      throw new Error('[Rush Engine] Failed to acquire 2D context from canvas element.');
    }
    this.context = ctx;

    // Core subsystems
    this.events = new EventEmitter<EngineEvents>();
    this.time = new Time(config.loopOptions?.fixedDeltaTime ?? 1 / 60);
    this.canvasManager = new CanvasManager(
      this.canvas,
      this.context,
      this.events,
      config.canvasOptions
    );
    this.renderer = new CanvasRenderer(
      this.canvas,
      this.context,
      this.canvasManager,
      config.rendererOptions
    );
    this.input = new InputManager({
      target: this.canvas,
      ...config.inputOptions,
    });
    this.input.init(this.canvas);
    this.sceneManager = new SceneManager(this);

    // Main Game Loop setup
    this.loop = new GameLoop(
      {
        onFixedUpdate: (fixedDt) => this.onFixedUpdate(fixedDt),
        onUpdate: (dt) => this.onUpdate(dt),
        onRender: (alpha) => this.onRender(alpha),
      },
      this.time,
      config.loopOptions
    );

    // Register initial scene if provided
    if (config.initialScene) {
      this.sceneManager.register(config.initialScene);
      this.sceneManager.switchScene(config.initialScene.name);
    }

    this.isInitialized = true;
    Engine.currentInstance = this;
    Logger.info('RushEngine', 'Rush Engine initialized successfully.');
  }

  /**
   * Factory bootstrap method for initializing a production Rush Engine instance.
   */
  public static bootstrap(config: EngineConfig): Engine {
    return new Engine(config);
  }

  /**
   * Starts the engine game loop.
   */
  public start(): void {
    if (this.isDestroyed) {
      Logger.error('RushEngine', 'Cannot start destroyed Rush Engine instance.');
      return;
    }

    this.loop.start();
    this.events.emit('start', undefined);
    Logger.info('RushEngine', 'Rush Engine loop started.');
  }

  /**
   * Stops the engine game loop.
   */
  public stop(): void {
    this.loop.stop();
    this.events.emit('stop', undefined);
    Logger.info('RushEngine', 'Rush Engine loop stopped.');
  }

  /**
   * Pauses game simulation updates.
   */
  public pause(): void {
    this.loop.pause();
    this.events.emit('pause', undefined);
  }

  /**
   * Resumes game simulation updates.
   */
  public resume(): void {
    this.loop.resume();
    this.events.emit('resume', undefined);
  }

  /**
   * Fixed-rate logic update callback.
   */
  private onFixedUpdate(fixedDelta: number): void {
    this.sceneManager.fixedUpdate(fixedDelta);
  }

  /**
   * Variable-rate frame update callback.
   */
  private onUpdate(delta: number): void {
    this.input.update();
    this.sceneManager.update(delta);
  }

  /**
   * Render frame callback with interpolation factor.
   */
  private onRender(alpha: number): void {
    this.renderer.beginFrame();
    this.sceneManager.render(this.renderer, alpha);
    this.renderer.endFrame();
  }

  /**
   * Disposes all engine resources, event listeners, and timers.
   */
  public destroy(): void {
    if (this.isDestroyed) return;

    this.stop();
    this.input.destroy();
    this.sceneManager.destroy();
    this.canvasManager.destroy();
    this.events.removeAllListeners();
    this.isDestroyed = true;
    if (Engine.currentInstance === this) {
      Engine.currentInstance = null;
    }

    Logger.info('Engine', 'Engine instance destroyed.');
  }

  /**
   * Returns whether the engine is active and running.
   */
  public get isRunning(): boolean {
    return this.loop.running && !this.loop.paused;
  }
}

