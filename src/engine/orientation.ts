/**
 * Landscape-only policy for phones.
 *
 * Geometry Rush is laid out for a wide screen. A phone held upright is not
 * allowed to run it: the app is covered and frozen until the viewport is
 * landscape again. Desktops, laptops and tablets are never restricted.
 */

/** What the policy needs to know about the device. Kept as plain data so it can be tested. */
export interface DeviceEnv {
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
  /** Physical screen size in CSS pixels, in either order. 0 when unknown. */
  screenWidth: number;
  screenHeight: number;
  /** The device has a touch screen. */
  touch: boolean;
  /** The browser identifies itself as a phone (a hint, never sufficient on its own). */
  mobileHint: boolean;
}

/** Shortest screen side below which a touch device is a phone. Tablets start at 600 CSS px. */
export const PHONE_MAX_SHORT_SIDE = 600;

/**
 * A phone is a touch device with a small screen. Screen size, not window
 * size, decides it, so a narrow desktop window or a tablet in split view is
 * not mistaken for one. The browser's own "mobile" hint only fills in when
 * the screen size is unavailable, and never counts without touch.
 */
export function isPhone(env: DeviceEnv): boolean {
  if (!env.touch) return false;
  const short = Math.min(env.screenWidth, env.screenHeight);
  if (short > 0) return short < PHONE_MAX_SHORT_SIDE;
  return env.mobileHint;
}

/** Orientation of the viewport the game is actually drawn into. */
export function isPortrait(env: DeviceEnv): boolean {
  return env.height > env.width;
}

/** True when the app must be blocked: a phone whose viewport is upright. */
export function shouldBlock(env: DeviceEnv): boolean {
  return isPhone(env) && isPortrait(env);
}

const MOBILE_UA = /\b(iPhone|iPod)\b|Android.*Mobile|Mobile.*Firefox|Windows Phone/;

export function readEnv(): DeviceEnv {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const coarse = typeof matchMedia === 'function' && matchMedia('(any-pointer: coarse)').matches;
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
    touch: (nav.maxTouchPoints ?? 0) > 0 || coarse,
    mobileHint: nav.userAgentData?.mobile ?? MOBILE_UA.test(nav.userAgent),
  };
}

type Listener = (blocked: boolean) => void;

/**
 * Watches the viewport and reports when the block starts or ends. While
 * blocked it also swallows keyboard, pointer and touch events before any other
 * part of the app can see them, except those aimed at `allow` (the overlay).
 */
export class OrientationGate {
  blocked = false;
  private allowed: Element | null = null;
  private readonly listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Registered before the rest of the app so these run first in the capture phase.
    for (const type of GUARDED) window.addEventListener(type, this.guard, { capture: true, passive: false });
    this.blocked = shouldBlock(readEnv());

    const check = () => this.check();
    // Some browsers report the new size a little after the rotation event.
    const settle = () => {
      check();
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(check, 300);
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', settle);
    window.visualViewport?.addEventListener('resize', check);
    window.screen?.orientation?.addEventListener?.('change', settle);
    if (typeof matchMedia === 'function') matchMedia('(orientation: portrait)').addEventListener?.('change', check);
    document.addEventListener('visibilitychange', check);
    // An installed app may lock without fullscreen, so the first gesture on a phone asks once.
    const first = () => {
      if (this.blocked) return;
      window.removeEventListener('pointerup', first, true);
      window.removeEventListener('keydown', first, true);
      if (isPhone(readEnv())) void lockLandscape();
    };
    window.addEventListener('pointerup', first, true);
    window.addEventListener('keydown', first, true);
    document.addEventListener('fullscreenchange', () => {
      // Entering fullscreen is the moment browsers accept an orientation lock.
      if (document.fullscreenElement && isPhone(readEnv())) void lockLandscape();
      settle();
    });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Names the element (the overlay) whose own controls stay usable while the
   * app is blocked. Its events are handled inside it and go no further.
   */
  allow(el: Element | null): void {
    if (el === this.allowed) return;
    for (const type of GUARDED) {
      this.allowed?.removeEventListener(type, contain);
      el?.addEventListener(type, contain);
    }
    this.allowed = el;
  }

  check(): void {
    const next = shouldBlock(readEnv());
    if (next === this.blocked) return;
    this.blocked = next;
    for (const fn of this.listeners) fn(next);
  }

  private readonly guard = (e: Event): void => {
    if (!this.blocked) return;
    const target = e.target;
    if (this.allowed && target instanceof Node && this.allowed.contains(target)) return;
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
  };
}

const contain = (e: Event): void => e.stopPropagation();

const GUARDED = [
  'keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'click', 'dblclick', 'contextmenu',
  'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel',
];

const LOCK_TIMEOUT_MS = 1500;

type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

/** True when the browser has the APIs needed to turn the screen for the player. */
export function canRotateForPlayer(): boolean {
  const o = window.screen?.orientation as LockableOrientation | undefined;
  return typeof o?.lock === 'function' && typeof document.documentElement.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
}

/**
 * Asks the browser to hold the screen in landscape (either way up). Most
 * browsers only allow this in fullscreen or an installed app, and some not at
 * all, so a refusal is an expected outcome, not an error.
 */
export async function lockLandscape(): Promise<boolean> {
  const o = window.screen?.orientation as LockableOrientation | undefined;
  if (typeof o?.lock !== 'function') return false;
  try {
    // A browser that never answers is treated like one that says no.
    const answer = await Promise.race([
      o.lock('landscape').then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), LOCK_TIMEOUT_MS)),
    ]);
    return answer;
  } catch {
    return false;
  }
}

/**
 * Goes fullscreen and locks to landscape, which turns the screen without the
 * player turning the phone. Must be called from a user gesture. Resolves true
 * only if the viewport really ended up landscape; otherwise fullscreen is left
 * again, so nothing changes on failure.
 */
export async function rotateForPlayer(): Promise<boolean> {
  if (!canRotateForPlayer()) return false;
  const entered = !document.fullscreenElement;
  try {
    if (entered) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    return false;
  }
  const locked = await lockLandscape();
  // A granted lock normally turns the viewport within a moment. If it has not, the lock did nothing useful.
  if (locked) await new Promise((resolve) => setTimeout(resolve, 700));
  const turned = locked && window.innerWidth >= window.innerHeight;
  if (!turned && entered && document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  return turned;
}
