export type HapticType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'error'
  | 'selection';

export type HapticIntensity = 'low' | 'medium' | 'high';

/**
 * HapticsManager provides a robust wrapper around the Browser Vibration API.
 * Features:
 * - isSupported() check for navigator.vibrate availability
 * - Graceful error handling and safety fallbacks (for iframe/security restrictions)
 * - Standardized haptic patterns ('light', 'medium', 'heavy', 'success', 'error', 'selection')
 * - Custom vibration durations and pattern arrays
 * - Intensity scaling ('low', 'medium', 'high') and configurable toggle
 * - Safe rate limiting to prevent hardware buffer congestion
 */
export class HapticsManager {
  private static instance: HapticsManager;

  private enabled: boolean = true;
  private intensity: HapticIntensity = 'medium';
  private supported: boolean = false;
  private lastHapticTime: number = 0;

  private constructor() {
    this.checkSupport();
  }

  public static getInstance(): HapticsManager {
    if (!HapticsManager.instance) {
      HapticsManager.instance = new HapticsManager();
    }
    return HapticsManager.instance;
  }

  /**
   * Evaluates if the current browser environment and hardware support physical vibration.
   */
  private checkSupport(): void {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      this.supported = typeof navigator.vibrate === 'function';
    } else {
      this.supported = false;
    }
  }

  /**
   * Returns true if the device & browser support physical vibration via navigator.vibrate.
   */
  public isSupported(): boolean {
    return this.supported;
  }

  /**
   * Returns whether haptic feedback is currently enabled in user preferences.
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enables or disables haptic feedback.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Returns the current haptic intensity ('low' | 'medium' | 'high').
   */
  public getIntensity(): HapticIntensity {
    return this.intensity;
  }

  /**
   * Sets the haptic intensity level.
   */
  public setIntensity(intensity: HapticIntensity): void {
    this.intensity = intensity;
  }

  /**
   * Calculates the timing multiplier based on configured intensity.
   */
  private getIntensityMultiplier(): number {
    switch (this.intensity) {
      case 'low':
        return 0.6;
      case 'high':
        return 1.4;
      case 'medium':
      default:
        return 1.0;
    }
  }

  /**
   * Scales a duration in milliseconds by the intensity multiplier.
   */
  private scaleDuration(ms: number): number {
    const scaled = Math.round(ms * this.getIntensityMultiplier());
    return Math.max(1, scaled);
  }

  /**
   * Dispatches a vibration pattern safely to navigator.vibrate with error trapping.
   */
  private triggerVibrate(pattern: number | number[]): boolean {
    if (!this.supported || !this.enabled || typeof navigator === 'undefined') {
      return false;
    }

    try {
      if (typeof navigator.vibrate === 'function') {
        return navigator.vibrate(pattern);
      }
    } catch {
      // Gracefully handle browser security restrictions or hardware errors
    }
    return false;
  }

  /**
   * Plays a pre-configured haptic event pattern, duration in ms, or custom pattern array.
   * Handles patterns: 'light', 'medium', 'heavy', 'success', 'error', 'selection'
   */
  public play(type: HapticType | number | number[]): boolean {
    if (!this.supported || !this.enabled) return false;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Rate limit: prevent spamming vibration if called repeatedly within 15ms
    if (now - this.lastHapticTime < 15 && type !== 'error' && type !== 'success') {
      return false;
    }
    this.lastHapticTime = now;

    // Direct millisecond duration
    if (typeof type === 'number') {
      return this.triggerVibrate(this.scaleDuration(type));
    }

    // Custom pattern array [vibrate, pause, vibrate, ...]
    if (Array.isArray(type)) {
      const mult = this.getIntensityMultiplier();
      const scaledPattern = type.map((val, idx) => (idx % 2 === 0 ? Math.max(1, Math.round(val * mult)) : val));
      return this.triggerVibrate(scaledPattern);
    }

    // Standardized preset patterns
    switch (type) {
      case 'selection': {
        // Subtle tactile tick for UI buttons (4ms - 8ms)
        return this.triggerVibrate(this.scaleDuration(6));
      }
      case 'light': {
        // Light tap for jump or non-fatal interactions (8ms - 20ms)
        return this.triggerVibrate(this.scaleDuration(14));
      }
      case 'medium': {
        // Solid pulse for landing or medium impacts (20ms - 45ms)
        return this.triggerVibrate(this.scaleDuration(32));
      }
      case 'heavy': {
        // Heavy pulse for death / crashes / critical impacts (35ms - 84ms)
        return this.triggerVibrate(this.scaleDuration(60));
      }
      case 'success': {
        // Multi-stage victory fanfare pattern [vibrate, pause, vibrate, pause, vibrate]
        const m = this.getIntensityMultiplier();
        const pattern = [
          Math.max(1, Math.round(18 * m)),
          35,
          Math.max(1, Math.round(25 * m)),
          35,
          Math.max(1, Math.round(45 * m)),
        ];
        return this.triggerVibrate(pattern);
      }
      case 'error': {
        // Staccato dual-buzz warning for invalid action / locked content
        const m = this.getIntensityMultiplier();
        const pattern = [
          Math.max(1, Math.round(22 * m)),
          30,
          Math.max(1, Math.round(22 * m)),
        ];
        return this.triggerVibrate(pattern);
      }
      default:
        return false;
    }
  }

  /**
   * Immediately stops any ongoing vibration sequence.
   */
  public stop(): void {
    if (this.supported && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore errors gracefully
      }
    }
  }
}

export const Haptics = HapticsManager.getInstance();
