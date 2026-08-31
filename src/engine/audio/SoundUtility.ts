import { SoundManager } from './SoundManager.ts';

export type MenuSoundType = 'hover' | 'click' | 'confirm' | 'back' | 'error' | 'toggle' | 'tick';

export interface SoundCueOptions {
  /** Slight pitch variation (+/- %) to prevent acoustic fatigue on repeated interactions */
  pitchVariation?: number;
  /** Volume multiplier (0 to 1) */
  volume?: number;
  /** Trigger brief physical haptic feedback on supported touch devices */
  haptic?: boolean;
}

/**
 * SoundUtility provides lightweight, high-performance tactile audio triggers
 * with automatic AudioContext gesture unlocking, anti-fatigue pitch variation,
 * and intelligent rate-limiting for menu buttons and interactive UI.
 */
export class SoundUtility {
  private static isInitialized = false;
  private static lastHoverTimestamp = 0;
  private static lastClickTimestamp = 0;

  /**
   * Registers global window listeners on first interaction to unlock
   * the Web Audio context instantly without delays.
   */
  public static initGestureUnlock(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    const unlock = () => {
      SoundManager.getInstance().init().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true, once: true });
    window.addEventListener('keydown', unlock, { passive: true, once: true });
    window.addEventListener('touchstart', unlock, { passive: true, once: true });
  }

  /**
   * Ultra-subtle, crisp high-harmonic hover tick.
   * Throttled to 30ms to prevent audio spam when sweeping cursor across buttons.
   */
  public static hover(options?: SoundCueOptions): void {
    const now = performance.now();
    if (now - this.lastHoverTimestamp < 30) return;
    this.lastHoverTimestamp = now;

    SoundManager.getInstance().playHover();
  }

  /**
   * Snappy tactile mechanical click for menu button presses.
   */
  public static click(options?: SoundCueOptions): void {
    const now = performance.now();
    if (now - this.lastClickTimestamp < 20) return;
    this.lastClickTimestamp = now;

    if (options?.haptic !== false && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(6);
      } catch {
        // Ignore haptic errors on unsupported devices
      }
    }

    SoundManager.getInstance().playClick();
  }

  /**
   * Uplifting harmonic affirmative confirmation chime for primary actions
   * (e.g. Starting a Level, Equipping a Skin, Entering Game).
   */
  public static confirm(options?: SoundCueOptions): void {
    if (options?.haptic !== false && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([8, 30, 12]);
      } catch {
        // Ignore haptic errors
      }
    }

    SoundManager.getInstance().playConfirm();
  }

  /**
   * Descending navigation back/cancel sound.
   */
  public static back(): void {
    SoundManager.getInstance().playBack();
  }

  /**
   * Low cyber warning buzz for invalid actions or locked selections.
   */
  public static error(): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(25);
      } catch {
        // Ignore haptic errors
      }
    }
    SoundManager.getInstance().playError();
  }

  /**
   * Dual-tone acoustic feedback for toggling checkboxes or switch states.
   */
  public static toggle(isOn: boolean): void {
    SoundManager.getInstance().playToggle(isOn);
  }

  /**
   * Fine-tuned slider tick when scrubbing volume or difficulty parameters.
   */
  public static tick(normalizedValue: number = 0.5): void {
    const manager = SoundManager.getInstance();
    if (typeof (manager as unknown as { playSliderTick?: (v: number) => void }).playSliderTick === 'function') {
      (manager as unknown as { playSliderTick: (v: number) => void }).playSliderTick(normalizedValue);
    } else {
      manager.playHover();
    }
  }

  /**
   * Shimmering cosmetic equip fanfare.
   */
  public static equip(): void {
    SoundManager.getInstance().playEquip();
  }

  /**
   * Generic dispatcher by sound type name.
   */
  public static play(type: MenuSoundType, options?: SoundCueOptions): void {
    switch (type) {
      case 'hover':
        this.hover(options);
        break;
      case 'confirm':
        this.confirm(options);
        break;
      case 'back':
        this.back();
        break;
      case 'error':
        this.error();
        break;
      case 'toggle':
        this.toggle(true);
        break;
      case 'tick':
        this.tick();
        break;
      case 'click':
      default:
        this.click(options);
        break;
    }
  }
}
