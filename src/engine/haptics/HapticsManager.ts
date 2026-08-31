export type HapticType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'error'
  | 'selection';

export type HapticIntensity = 'low' | 'medium' | 'high';

/**
 * HapticsManager provides device-independent physical tactile feedback
 * using the browser Vibration API with graceful degradation, intensity scaling,
 * pattern management, and strict rate-limiting.
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

  private checkSupport(): void {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      this.supported = typeof navigator.vibrate === 'function';
    } else {
      this.supported = false;
    }
  }

  /**
   * Returns true if the device & browser support physical vibration.
   */
  public isSupported(): boolean {
    return this.supported;
  }

  /**
   * Returns whether haptic feedback is enabled in user preferences.
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
   * Sets the haptic intensity scale.
   */
  public setIntensity(intensity: HapticIntensity): void {
    this.intensity = intensity;
  }

  /**
   * Calculates the multiplier based on configured intensity.
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
   * Dispatches a vibration pattern safely with debounce and error trapping.
   */
  private triggerVibrate(pattern: number | number[]): void {
    if (!this.supported || !this.enabled || typeof navigator === 'undefined') {
      return;
    }

    try {
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Gracefully ignore browser vibration security errors or hardware busy states
    }
  }

  /**
   * Plays a pre-configured haptic event pattern or custom millisecond array.
   */
  public play(type: HapticType | number | number[]): void {
    if (!this.supported || !this.enabled) return;

    const now = performance.now();
    // Rate limit: prevent spamming vibration if called repeatedly within 15ms
    if (now - this.lastHapticTime < 15 && type !== 'error' && type !== 'success') {
      return;
    }
    this.lastHapticTime = now;

    if (typeof type === 'number') {
      this.triggerVibrate(this.scaleDuration(type));
      return;
    }

    if (Array.isArray(type)) {
      const mult = this.getIntensityMultiplier();
      const scaledPattern = type.map((val, idx) => (idx % 2 === 0 ? Math.max(1, Math.round(val * mult)) : val));
      this.triggerVibrate(scaledPattern);
      return;
    }

    switch (type) {
      case 'selection': {
        // Ultra-short tactile tick for menu buttons (4ms low, 6ms med, 8ms high)
        this.triggerVibrate(this.scaleDuration(6));
        break;
      }
      case 'light': {
        // Light tap for jump or important confirmation (8ms low, 14ms med, 20ms high)
        this.triggerVibrate(this.scaleDuration(14));
        break;
      }
      case 'medium': {
        // Solid pulse for landing or medium impacts (20ms low, 32ms med, 45ms high)
        this.triggerVibrate(this.scaleDuration(32));
        break;
      }
      case 'heavy': {
        // Heavy pulse for death/crashes (35ms low, 60ms med, 84ms high)
        this.triggerVibrate(this.scaleDuration(60));
        break;
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
        this.triggerVibrate(pattern);
        break;
      }
      case 'error': {
        // Staccato dual-buzz warning for invalid action / locked content
        const m = this.getIntensityMultiplier();
        const pattern = [
          Math.max(1, Math.round(22 * m)),
          30,
          Math.max(1, Math.round(22 * m)),
        ];
        this.triggerVibrate(pattern);
        break;
      }
    }
  }

  /**
   * Immediately stops any ongoing vibration.
   */
  public stop(): void {
    if (this.supported && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore
      }
    }
  }
}

export const Haptics = HapticsManager.getInstance();
