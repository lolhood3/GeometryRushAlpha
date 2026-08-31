import { CanvasManager } from './CanvasManager.ts';

export interface CanvasRendererOptions {
  /**
   * Default background clear color (default: '#000000').
   */
  backgroundColor?: string;
}

export interface DrawRectOptions {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  rotation?: number; // rotation in radians around center or (x, y)
  centerOrigin?: boolean; // if true, (x, y) is the center of the rectangle
}

export interface DrawCircleOptions {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  startAngle?: number;
  endAngle?: number;
}

export interface DrawLineOptions {
  stroke?: string;
  lineWidth?: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  dash?: number[];
}

export interface DrawTextOptions {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  font?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
  maxWidth?: number;
}

export interface DrawImageOptions {
  alpha?: number;
  rotation?: number;
  centerOrigin?: boolean;
  sourceX?: number;
  sourceY?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

/**
 * Rush Engine 2D Canvas renderer responsible for graphics rendering, frame clearing,
 * transform stack management, High-DPI projection, and drawing primitives.
 * The game must never access CanvasRenderingContext2D directly.
 */
export class CanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly manager: CanvasManager;

  public backgroundColor: string;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    manager: CanvasManager,
    options: CanvasRendererOptions = {}
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.manager = manager;
    this.backgroundColor = options.backgroundColor ?? '#000000';
  }

  /**
   * The underlying 2D rendering context.
   */
  public get context(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Logical width in CSS pixels.
   */
  public get width(): number {
    return this.manager.width;
  }

  /**
   * Logical height in CSS pixels.
   */
  public get height(): number {
    return this.manager.height;
  }

  /**
   * Prepares the canvas for rendering the next frame.
   * Sets up DPR scaling so coordinates can be expressed in logical units.
   */
  public beginFrame(): void {
    const dpr = this.manager.devicePixelRatio;

    // Reset transform to identity and clear physical buffer
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply DPR scale so all drawing operations use logical coordinate space
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Clears the canvas buffer with the specified color.
   * Safe to call anywhere in render without corrupting active transforms.
   * @param color CSS color string (defaults to this.backgroundColor).
   */
  public clear(color: string = this.backgroundColor): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /**
   * Finalizes the current frame.
   */
  public endFrame(): void {
    // Reserved for post-processing or buffer swap operations if needed in the future.
  }

  /**
   * Draws a rectangle with optional fill, stroke, rotation, and center-origin positioning.
   */
  public drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    options: DrawRectOptions = {}
  ): void {
    const fill = options.fill ?? '#ffffff';
    const stroke = options.stroke;
    const lineWidth = options.lineWidth ?? 1;
    const rotation = options.rotation;
    const centerOrigin = options.centerOrigin ?? false;

    const hasTransform = (rotation !== undefined && rotation !== 0) || centerOrigin;

    if (hasTransform) {
      this.ctx.save();
      if (centerOrigin) {
        this.ctx.translate(x, y);
        if (rotation) {
          this.ctx.rotate(rotation);
        }
        const drawX = -width / 2;
        const drawY = -height / 2;

        if (fill) {
          this.ctx.fillStyle = fill;
          this.ctx.fillRect(drawX, drawY, width, height);
        }
        if (stroke) {
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = lineWidth;
          this.ctx.strokeRect(drawX, drawY, width, height);
        }
      } else {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        this.ctx.translate(centerX, centerY);
        if (rotation) {
          this.ctx.rotate(rotation);
        }
        const drawX = -width / 2;
        const drawY = -height / 2;

        if (fill) {
          this.ctx.fillStyle = fill;
          this.ctx.fillRect(drawX, drawY, width, height);
        }
        if (stroke) {
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = lineWidth;
          this.ctx.strokeRect(drawX, drawY, width, height);
        }
      }
      this.ctx.restore();
    } else {
      if (fill) {
        this.ctx.fillStyle = fill;
        this.ctx.fillRect(x, y, width, height);
      }
      if (stroke) {
        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeRect(x, y, width, height);
      }
    }
  }

  /**
   * Draws a circle with optional fill and stroke.
   */
  public drawCircle(
    x: number,
    y: number,
    radius: number,
    options: DrawCircleOptions = {}
  ): void {
    if (radius <= 0) return;

    const fill = options.fill ?? '#ffffff';
    const stroke = options.stroke;
    const lineWidth = options.lineWidth ?? 1;
    const startAngle = options.startAngle ?? 0;
    const endAngle = options.endAngle ?? Math.PI * 2;

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, startAngle, endAngle);

    if (fill) {
      this.ctx.fillStyle = fill;
      this.ctx.fill();
    }

    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }

  /**
   * Draws a straight line between two points.
   */
  public drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: DrawLineOptions = {}
  ): void {
    const stroke = options.stroke ?? '#ffffff';
    const lineWidth = options.lineWidth ?? 1;
    const hasDash = options.dash !== undefined && options.dash.length > 0;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);

    this.ctx.strokeStyle = stroke;
    this.ctx.lineWidth = lineWidth;

    if (options.lineCap) {
      this.ctx.lineCap = options.lineCap;
    }
    if (options.lineJoin) {
      this.ctx.lineJoin = options.lineJoin;
    }
    if (hasDash && options.dash) {
      this.ctx.setLineDash(options.dash);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Draws styled text at the specified coordinates.
   */
  public drawText(
    text: string,
    x: number,
    y: number,
    options: DrawTextOptions = {}
  ): void {
    const fill = options.fill ?? '#ffffff';
    const stroke = options.stroke;
    const lineWidth = options.lineWidth ?? 1;
    const fontSize = options.fontSize ?? 16;
    const fontFamily = options.fontFamily ?? 'sans-serif';
    const fontWeight = options.fontWeight ?? 'normal';
    const font = options.font ?? `${fontWeight} ${fontSize}px ${fontFamily}`;

    this.ctx.save();
    this.ctx.font = font;

    if (options.textAlign) {
      this.ctx.textAlign = options.textAlign;
    }
    if (options.textBaseline) {
      this.ctx.textBaseline = options.textBaseline;
    }

    if (fill) {
      this.ctx.fillStyle = fill;
      if (options.maxWidth !== undefined) {
        this.ctx.fillText(text, x, y, options.maxWidth);
      } else {
        this.ctx.fillText(text, x, y);
      }
    }

    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = lineWidth;
      if (options.maxWidth !== undefined) {
        this.ctx.strokeText(text, x, y, options.maxWidth);
      } else {
        this.ctx.strokeText(text, x, y);
      }
    }

    this.ctx.restore();
  }

  private getImageDimensions(image: CanvasImageSource): { width: number; height: number } {
    if ('width' in image && typeof image.width === 'number') {
      return { width: image.width, height: (image as { height: number }).height ?? 0 };
    }
    if ('videoWidth' in image && typeof image.videoWidth === 'number') {
      return { width: image.videoWidth, height: image.videoHeight };
    }
    if ('displayWidth' in image && typeof image.displayWidth === 'number') {
      return { width: image.displayWidth, height: image.displayHeight };
    }
    return { width: 0, height: 0 };
  }

  /**
   * Draws an image or sub-region of an image with optional alpha, rotation, and scaling.
   */
  public drawImage(
    image: CanvasImageSource,
    x: number,
    y: number,
    width?: number,
    height?: number,
    options: DrawImageOptions = {}
  ): void {
    const defaultDims = this.getImageDimensions(image);
    const targetWidth = width ?? defaultDims.width;
    const targetHeight = height ?? defaultDims.height;

    const alpha = options.alpha;
    const rotation = options.rotation;
    const centerOrigin = options.centerOrigin ?? false;

    const hasStateChange = alpha !== undefined || (rotation !== undefined && rotation !== 0) || centerOrigin;

    if (hasStateChange) {
      this.ctx.save();
      if (alpha !== undefined) {
        this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      }

      if (centerOrigin) {
        this.ctx.translate(x, y);
        if (rotation) {
          this.ctx.rotate(rotation);
        }
        const drawX = -targetWidth / 2;
        const drawY = -targetHeight / 2;
        this.renderImageSource(image, drawX, drawY, targetWidth, targetHeight, options);
      } else if (rotation) {
        const centerX = x + targetWidth / 2;
        const centerY = y + targetHeight / 2;
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate(rotation);
        const drawX = -targetWidth / 2;
        const drawY = -targetHeight / 2;
        this.renderImageSource(image, drawX, drawY, targetWidth, targetHeight, options);
      } else {
        this.renderImageSource(image, x, y, targetWidth, targetHeight, options);
      }
      this.ctx.restore();
    } else {
      this.renderImageSource(image, x, y, targetWidth, targetHeight, options);
    }
  }

  private renderImageSource(
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
    options: DrawImageOptions
  ): void {
    if (
      options.sourceX !== undefined &&
      options.sourceY !== undefined &&
      options.sourceWidth !== undefined &&
      options.sourceHeight !== undefined
    ) {
      this.ctx.drawImage(
        image,
        options.sourceX,
        options.sourceY,
        options.sourceWidth,
        options.sourceHeight,
        dx,
        dy,
        dWidth,
        dHeight
      );
    } else if (dWidth > 0 && dHeight > 0) {
      this.ctx.drawImage(image, dx, dy, dWidth, dHeight);
    } else {
      this.ctx.drawImage(image, dx, dy);
    }
  }

  /**
   * Saves the current canvas drawing state onto the state stack.
   */
  public save(): void {
    this.ctx.save();
  }

  /**
   * Restores the most recently saved canvas drawing state.
   */
  public restore(): void {
    this.ctx.restore();
  }

  /**
   * Translates the canvas coordinate space.
   */
  public translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }

  /**
   * Rotates the canvas coordinate space in radians.
   */
  public rotate(angleInRadians: number): void {
    this.ctx.rotate(angleInRadians);
  }

  /**
   * Scales the canvas coordinate space.
   */
  public scale(x: number, y: number): void {
    this.ctx.scale(x, y);
  }
}

