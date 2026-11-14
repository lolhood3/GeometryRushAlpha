export interface InputEdge {
  down: boolean;
  /** Event time in seconds on the performance.now() timeline. */
  time: number;
}

const ACTION_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyX']);

/**
 * One-button input from keyboard, mouse, touch and gamepad. Presses and
 * releases are queued with their hardware timestamps so the game can place
 * them on the exact simulation tick they happened on, independent of frame
 * rate.
 */
export class Input {
  /** When false, events are ignored and nothing is queued. */
  enabled = false;
  held = false;
  private readonly keys = new Set<string>();
  private readonly pointers = new Set<number>();
  private pad = false;
  private readonly queue: InputEdge[] = [];
  private ignore: string | null = null;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
  }

  /**
   * Starts listening for pointer presses anywhere in the window. Presses that
   * land on elements matching `ignore` (buttons, dialogs…) are left to the UI.
   */
  attach(ignore: string): void {
    if (this.ignore !== null) return;
    this.ignore = ignore;
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
  }

  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    this.keys.clear();
    this.pointers.clear();
    this.pad = false;
    this.queue.length = 0;
    this.held = false;
  }

  /** Returns and clears the queued edges (oldest first). */
  drain(out: InputEdge[]): void {
    out.length = 0;
    for (const e of this.queue) out.push(e);
    this.queue.length = 0;
  }

  /** Gamepads have no events; call once per frame. */
  poll(): void {
    if (!this.enabled || !navigator.getGamepads) return;
    let down = false;
    const pads = navigator.getGamepads();
    for (const p of pads) {
      if (!p) continue;
      if (p.buttons[0]?.pressed || p.buttons[1]?.pressed || p.buttons[12]?.pressed) down = true;
    }
    if (down !== this.pad) {
      this.pad = down;
      this.update(performance.now());
    }
  }

  private update(stamp: number): void {
    const held = this.keys.size > 0 || this.pointers.size > 0 || this.pad;
    if (held === this.held) return;
    this.held = held;
    // Some browsers report event timestamps on a different epoch; fall back to "now".
    const now = performance.now();
    const t = stamp > 0 && stamp <= now && now - stamp < 100 ? stamp : now;
    this.queue.push({ down: held, time: t / 1000 });
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled || !ACTION_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    this.update(e.timeStamp);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (!this.keys.delete(e.code)) return;
    this.update(e.timeStamp);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.target as Element | null;
    if (this.ignore && el && typeof el.closest === 'function' && el.closest(this.ignore)) return;
    this.pointers.add(e.pointerId);
    this.update(e.timeStamp);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.pointers.delete(e.pointerId)) return;
    this.update(e.timeStamp);
  };

  private readonly releaseAll = (): void => {
    if (this.keys.size === 0 && this.pointers.size === 0 && !this.pad) return;
    this.keys.clear();
    this.pointers.clear();
    this.pad = false;
    this.update(performance.now());
  };
}
