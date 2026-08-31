import { EventEmitter } from '../core/EventEmitter.ts';
import { Logger } from '../utils/Logger.ts';

export interface CanvasResizeEvent {
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
}

export interface CanvasManagerOptions {
  /**
   * Automatically resize canvas to match parent container or window. Defaults to true.
   */
  autoResize?: boolean;

  /**
   * Maximum allowed device pixel ratio (default: 2 to prevent excessive GPU memory on ultra-dense screens).
   */
  maxDpr?: number;

  /**
   * Custom target fixed width (if not auto-resizing).
   */
  fixedWidth?: number;

  /**
   * Custom target fixed height (if not auto-resizing).
   */
  fixedHeight?: number;
}

export interface IResizeEmitter {
  emit(event: 'resize', data: CanvasResizeEvent): void;
}

/**
 * Manages HTML5 Canvas sizing, responsive container bounds, window resize listeners,
 * and high-DPI (devicePixelRatio) backing store scaling for Rush Engine.
 */
export class CanvasManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly events: IResizeEmitter;

  private readonly autoResize: boolean = true;
  private readonly maxDpr: number = 2;
  private dpr: number = 1;

  private logicalWidth: number = 800;
  private logicalHeight: number = 600;

  private resizeObserver: ResizeObserver | null = null;
  private boundWindowResizeHandler: (() => void) | null = null;
  private dprMediaQueryList: MediaQueryList | null = null;
  private boundDprChangeHandler: (() => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    events: IResizeEmitter,
    options: CanvasManagerOptions = {}
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.events = events;

    this.autoResize = options.autoResize ?? true;
    this.maxDpr = options.maxDpr ?? 2;

    if (options.fixedWidth && options.fixedHeight) {
      this.logicalWidth = Math.max(1, options.fixedWidth);
      this.logicalHeight = Math.max(1, options.fixedHeight);
      this.autoResize = false;
    }

    this.setupListeners();
    this.resize();
  }

  /**
   * Initializes resize listeners and High-DPI monitor listeners.
   */
  private setupListeners(): void {
    if (this.autoResize) {
      // 1. ResizeObserver on parent container
      if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
        this.resizeObserver = new ResizeObserver(() => {
          if (typeof window !== 'undefined') {
            window.requestAnimationFrame(() => this.resize());
          } else {
            this.resize();
          }
        });
        this.resizeObserver.observe(this.canvas.parentElement);
      }

      // 2. Window resize event fallback
      this.boundWindowResizeHandler = () => this.resize();
      window.addEventListener('resize', this.boundWindowResizeHandler);
    }

    // 3. Listen to display DPI / browser zoom changes
    this.listenToDprChanges();
  }

  private listenToDprChanges(): void {
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return;

      this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
      this.dprMediaQueryList = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      
      this.boundDprChangeHandler = () => {
        this.listenToDprChanges();
        this.resize();
      };

      if (this.dprMediaQueryList.addEventListener) {
        this.dprMediaQueryList.addEventListener('change', this.boundDprChangeHandler, { once: true });
      } else if ('addListener' in (this.dprMediaQueryList as unknown as { addListener: (cb: () => void) => void })) {
        (this.dprMediaQueryList as unknown as { addListener: (cb: () => void) => void }).addListener(this.boundDprChangeHandler);
      }
    } catch {
      // Safely ignore media query restrictions in cross-origin iframe sandbox
    }
  }

  /**
   * Recalculates canvas dimensions and adjusts backing store pixels for high-DPI displays.
   */
  public resize(): void {
    try {
      const parent = this.canvas.parentElement;
      let cssWidth = this.logicalWidth;
      let cssHeight = this.logicalHeight;

      if (this.autoResize && parent) {
        const rect = parent.getBoundingClientRect();
        cssWidth = Math.floor(rect.width) || (typeof window !== 'undefined' ? window.innerWidth : 800);
        cssHeight = Math.floor(rect.height) || (typeof window !== 'undefined' ? window.innerHeight : 600);
      } else if (this.autoResize && typeof window !== 'undefined') {
        cssWidth = window.innerWidth;
        cssHeight = window.innerHeight;
      }

      this.dpr = Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, this.maxDpr);
      this.logicalWidth = cssWidth;
      this.logicalHeight = cssHeight;

      const pixelWidth = Math.floor(cssWidth * this.dpr);
      const pixelHeight = Math.floor(cssHeight * this.dpr);

      // Only update canvas buffer if dimensions actually changed
      if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
        this.canvas.width = pixelWidth;
        this.canvas.height = pixelHeight;
        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;

        Logger.debug(
          'CanvasManager',
          `Resized: ${cssWidth}x${cssHeight} logical (${pixelWidth}x${pixelHeight} physical @ ${this.dpr}x DPR)`
        );

        this.events.emit('resize', {
          width: cssWidth,
          height: cssHeight,
          pixelWidth,
          pixelHeight,
          dpr: this.dpr,
        });
      }
    } catch {
      // Gracefully handle iframe resizing edge cases
    }
  }

  /**
   * Logical width in CSS pixels.
   */
  public get width(): number {
    return this.logicalWidth;
  }

  /**
   * Logical height in CSS pixels.
   */
  public get height(): number {
    return this.logicalHeight;
  }

  /**
   * Current active device pixel ratio.
   */
  public get devicePixelRatio(): number {
    return this.dpr;
  }

  /**
   * Aspect ratio (width / height).
   */
  public get aspectRatio(): number {
    return this.logicalHeight > 0 ? this.logicalWidth / this.logicalHeight : 1;
  }

  /**
   * Destroys all observers and listeners.
   */
  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.boundWindowResizeHandler) {
      window.removeEventListener('resize', this.boundWindowResizeHandler);
      this.boundWindowResizeHandler = null;
    }
    if (this.dprMediaQueryList && this.boundDprChangeHandler) {
      this.dprMediaQueryList.removeEventListener('change', this.boundDprChangeHandler);
      this.dprMediaQueryList = null;
      this.boundDprChangeHandler = null;
    }
  }
}
