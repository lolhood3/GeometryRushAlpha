/**
 * Device, screen orientation, touch, and viewport utility helpers for Rush Engine.
 */

export type DeviceType = 'desktop' | 'tablet' | 'mobile';
export type PrimaryInputType = 'keyboard' | 'mouse' | 'touch' | 'pen' | 'hybrid';
export type ScreenOrientationType = 'landscape' | 'portrait';

export interface DeviceInfo {
  deviceType: DeviceType;
  primaryInput: PrimaryInputType;
  isTouchDevice: boolean;
  maxTouchPoints: number;
  orientation: ScreenOrientationType;
  orientationAngle: number;
  dpr: number;
  viewportWidth: number;
  viewportHeight: number;
  isFullscreen: boolean;
}

export class DeviceUtils {
  /**
   * Returns true if the device supports touch input.
   */
  public static isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      Boolean((navigator as unknown as { msMaxTouchPoints?: number }).msMaxTouchPoints) ||
      window.matchMedia?.('(pointer: coarse)')?.matches === true
    );
  }

  /**
   * Classifies the current platform as 'desktop', 'tablet', or 'mobile'.
   */
  public static getDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';

    const ua = navigator.userAgent.toLowerCase();
    const isTouch = DeviceUtils.isTouchDevice();
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const maxDim = Math.max(window.innerWidth, window.innerHeight);

    // Explicit mobile user agent flags
    const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isTabletUA = /ipad|tablet|(android(?!.*mobile))/i.test(ua);

    if (isTabletUA || (isTouch && minDim >= 600 && maxDim <= 1366)) {
      return 'tablet';
    }

    if (isMobileUA || (isTouch && minDim < 600)) {
      return 'mobile';
    }

    if (isTouch && minDim >= 600) {
      return 'tablet';
    }

    return 'desktop';
  }

  /**
   * Returns current orientation: 'landscape' or 'portrait'.
   */
  public static getOrientation(): ScreenOrientationType {
    if (typeof window === 'undefined') return 'landscape';

    if (window.screen?.orientation?.type) {
      return window.screen.orientation.type.includes('portrait') ? 'portrait' : 'landscape';
    }

    if (typeof window.orientation === 'number') {
      return Math.abs(window.orientation as number) === 90 ? 'landscape' : 'portrait';
    }

    return window.innerWidth < window.innerHeight ? 'portrait' : 'landscape';
  }

  /**
   * Returns screen orientation angle in degrees (0, 90, 180, 270).
   */
  public static getOrientationAngle(): number {
    if (typeof window === 'undefined') return 0;
    if (typeof window.screen?.orientation?.angle === 'number') {
      return window.screen.orientation.angle;
    }
    if (typeof window.orientation === 'number') {
      return window.orientation as number;
    }
    return 0;
  }

  /**
   * Returns the primary input modality detected.
   */
  public static getPrimaryInputType(): PrimaryInputType {
    if (typeof window === 'undefined') return 'keyboard';

    const hasFine = window.matchMedia?.('(pointer: fine)')?.matches;
    const hasCoarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    const isTouch = DeviceUtils.isTouchDevice();

    if (isTouch && !hasFine) return 'touch';
    if (hasFine && !isTouch) return 'mouse';
    if (isTouch && hasFine) return 'hybrid';
    return 'keyboard';
  }

  /**
   * Checks whether the browser is currently in fullscreen mode.
   */
  public static isFullscreen(): boolean {
    if (typeof document === 'undefined') return false;
    return Boolean(
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
      (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
      (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
    );
  }

  /**
   * Safely attempts to request fullscreen for the application.
   */
  public static async requestFullscreen(element?: HTMLElement): Promise<boolean> {
    if (typeof document === 'undefined') return false;
    const el = element || document.documentElement;

    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return true;
      }
      const webkitEl = el as unknown as { webkitRequestFullscreen?: () => Promise<void> };
      if (webkitEl.webkitRequestFullscreen) {
        await webkitEl.webkitRequestFullscreen();
        return true;
      }
    } catch {
      // Ignore fullscreen rejection in iframe sandboxes
    }
    return false;
  }

  /**
   * Safely attempts to exit fullscreen mode.
   */
  public static async exitFullscreen(): Promise<boolean> {
    if (typeof document === 'undefined') return false;
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return true;
      }
      const webkitDoc = document as unknown as { webkitExitFullscreen?: () => Promise<void> };
      if (webkitDoc.webkitExitFullscreen) {
        await webkitDoc.webkitExitFullscreen();
        return true;
      }
    } catch {
      // Ignore
    }
    return false;
  }

  /**
   * Safely attempts to lock device orientation to landscape where supported.
   */
  public static async lockLandscape(): Promise<boolean> {
    try {
      const orientation = window.screen?.orientation as unknown as {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation?.lock) {
        await orientation.lock('landscape');
        return true;
      }
    } catch {
      // Safely catch NotSupportedError / SecurityError in iframe sandbox
    }
    return false;
  }

  /**
   * Collects all device and viewport metrics into a consolidated object.
   */
  public static getDeviceInfo(): DeviceInfo {
    const isTouch = DeviceUtils.isTouchDevice();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 600;

    return {
      deviceType: DeviceUtils.getDeviceType(),
      primaryInput: DeviceUtils.getPrimaryInputType(),
      isTouchDevice: isTouch,
      maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0,
      orientation: DeviceUtils.getOrientation(),
      orientationAngle: DeviceUtils.getOrientationAngle(),
      dpr,
      viewportWidth,
      viewportHeight,
      isFullscreen: DeviceUtils.isFullscreen(),
    };
  }
}
