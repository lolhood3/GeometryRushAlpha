import { Logger } from '../utils/Logger.ts';
import type { IInputManager, InputAction, PointerType } from './index.ts';

export interface ActionBinding {
  keys: string[];
  allowPointer?: boolean;
}

export interface InputManagerOptions {
  /**
   * Target element to bind pointer and keyboard events to (defaults to window).
   */
  target?: Window | HTMLElement;
  /**
   * Automatically prevent default browser behavior for common game keys (Space, Arrows, etc.).
   */
  preventDefaultForGameKeys?: boolean;
  /**
   * Automatically prevent browser default on pointerdown on target canvas to avoid scrolling/zooming.
   */
  preventDefaultOnPointer?: boolean;
}

const DEFAULT_PREVENT_KEYS = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  ' ',
]);

/**
 * Production-ready Unified Input Manager for Rush Engine.
 * Unifies Keyboard, Mouse, Touch, and Pen/Stylus input into device-independent
 * action queries (isActionDown, isActionPressed, isActionReleased) while maintaining
 * 100% backward compatibility with key-specific queries.
 *
 * Utilizes W3C Pointer Events with decoupled async frame buffering to ensure
 * deterministic, frame-accurate inputs across desktop, laptop, mobile, and tablets.
 */
export class InputManager implements IInputManager {
  private targetElement: HTMLElement | null = null;
  private isWindowTarget: boolean = true;
  private preventDefaultForGameKeys: boolean;
  private preventDefaultOnPointer: boolean;

  // Keyboard state sets
  private readonly keysDown: Set<string> = new Set();
  private readonly keysPressed: Set<string> = new Set();
  private readonly keysReleased: Set<string> = new Set();

  private readonly pendingDownBuffer: Set<string> = new Set();
  private readonly pendingUpBuffer: Set<string> = new Set();

  // Pointer state & tracking
  private primaryPointerId: number | null = null;
  private currentPointerType: PointerType = 'none';
  private pointerClientX: number = 0;
  private pointerClientY: number = 0;
  private pointerLogicalX: number = 0;
  private pointerLogicalY: number = 0;
  private lastTouchTimestamp: number = 0;
  private readonly activePointers: Map<
    number,
    { clientX: number; clientY: number; type: PointerType; timestamp: number }
  > = new Map();

  private isPointerPhysicallyDown: boolean = false;
  private pointerDown: boolean = false;
  private pointerPressed: boolean = false;
  private pointerReleased: boolean = false;

  private pointerPulsePressed: boolean = false;
  private pointerPulseReleased: boolean = false;

  // Action mapping dictionary
  private readonly actionBindings: Map<string, ActionBinding> = new Map();

  // Action state sets
  private readonly actionsDown: Set<string> = new Set();
  private readonly actionsPressed: Set<string> = new Set();
  private readonly actionsReleased: Set<string> = new Set();

  private readonly pendingActionDownBuffer: Set<string> = new Set();
  private readonly pendingActionUpBuffer: Set<string> = new Set();

  private isInitialized: boolean = false;

  // Bound event listeners
  private readonly onKeyDownBound: (e: KeyboardEvent) => void;
  private readonly onKeyUpBound: (e: KeyboardEvent) => void;
  private readonly onBlurBound: () => void;
  private readonly onPointerDownBound: (e: PointerEvent) => void;
  private readonly onPointerUpBound: (e: PointerEvent) => void;
  private readonly onPointerCancelBound: (e: PointerEvent) => void;
  private readonly onPointerMoveBound: (e: PointerEvent) => void;
  private readonly onContextMenuBound: (e: MouseEvent) => void;

  constructor(options: InputManagerOptions = {}) {
    if (options.target && typeof window !== 'undefined' && options.target !== window) {
      this.targetElement = options.target as HTMLElement;
      this.isWindowTarget = false;
    } else {
      this.targetElement = null;
      this.isWindowTarget = true;
    }

    this.preventDefaultForGameKeys = options.preventDefaultForGameKeys ?? true;
    this.preventDefaultOnPointer = options.preventDefaultOnPointer ?? true;

    this.onKeyDownBound = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.onKeyUpBound = (e: KeyboardEvent) => this.handleKeyUp(e);
    this.onBlurBound = () => this.handleBlur();
    this.onPointerDownBound = (e: PointerEvent) => this.handlePointerDown(e);
    this.onPointerUpBound = (e: PointerEvent) => this.handlePointerUp(e);
    this.onPointerCancelBound = (e: PointerEvent) => this.handlePointerCancel(e);
    this.onPointerMoveBound = (e: PointerEvent) => this.handlePointerMove(e);
    this.onContextMenuBound = (e: MouseEvent) => this.handleContextMenu(e);

    // Register standard default actions for Geometry Rush
    this.bindAction('jump', ['Space', ' ', 'ArrowUp', 'KeyW', 'w', 'W'], { allowPointer: true });
    this.bindAction('restart', ['KeyR', 'r', 'R'], { allowPointer: false });
    this.bindAction('pause', ['Escape', 'Esc'], { allowPointer: false });
  }

  /**
   * Configures or extends an action binding with key codes and optional pointer interaction.
   */
  public bindAction(action: InputAction, keys: string[], options: { allowPointer?: boolean } = {}): void {
    const existing = this.actionBindings.get(action);
    const keyList = existing ? Array.from(new Set([...existing.keys, ...keys])) : keys;
    this.actionBindings.set(action, {
      keys: keyList,
      allowPointer: options.allowPointer ?? (existing?.allowPointer ?? false),
    });
  }

  /**
   * Initializes event listeners on the target canvas / window.
   */
  public init(target?: Window | HTMLElement): void {
    if (this.isInitialized) return;

    if (target && typeof window !== 'undefined' && target !== window) {
      this.targetElement = target as HTMLElement;
      this.isWindowTarget = false;
    }

    try {
      const pointerTarget = this.targetElement || (typeof window !== 'undefined' ? window : null);

      if (pointerTarget) {
        pointerTarget.addEventListener('pointerdown', this.onPointerDownBound as EventListener, { passive: false });
        pointerTarget.addEventListener('pointerup', this.onPointerUpBound as EventListener, { passive: false });
        pointerTarget.addEventListener('pointercancel', this.onPointerCancelBound as EventListener, { passive: false });
        pointerTarget.addEventListener('pointermove', this.onPointerMoveBound as EventListener, { passive: true });
        pointerTarget.addEventListener('contextmenu', this.onContextMenuBound as EventListener);
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', this.onPointerUpBound as EventListener, { passive: false });
        window.addEventListener('pointercancel', this.onPointerCancelBound as EventListener, { passive: false });
        window.addEventListener('keydown', this.onKeyDownBound as EventListener, { passive: false });
        window.addEventListener('keyup', this.onKeyUpBound as EventListener, { passive: false });
        window.addEventListener('blur', this.onBlurBound);
      }

      this.isInitialized = true;
      Logger.debug('InputManager', 'Unified Input System initialized (Keyboard + Pointer Events).');
    } catch {
      // Safely ignore sandbox restrictions
    }
  }

  /**
   * Called at the start of each engine frame tick to swap buffers and evaluate frame transitions.
   */
  public update(): void {
    // 1. Clear single-frame transition sets
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.actionsPressed.clear();
    this.actionsReleased.clear();

    // 2. Process keys pressed since the last frame
    for (const code of this.pendingDownBuffer) {
      this.keysDown.add(code);
      this.keysPressed.add(code);
    }
    this.pendingDownBuffer.clear();

    // 3. Process keys released since the last frame
    for (const code of this.pendingUpBuffer) {
      this.keysDown.delete(code);
      this.keysReleased.add(code);
    }
    this.pendingUpBuffer.clear();

    // 4. Process Pointer transitions via atomic pulse buffering
    const wasPointerDown = this.pointerDown;
    this.pointerDown = this.isPointerPhysicallyDown;

    this.pointerPressed = this.pointerPulsePressed;
    this.pointerPulsePressed = false;

    this.pointerReleased = this.pointerPulseReleased || (!this.pointerDown && wasPointerDown);
    this.pointerPulseReleased = false;

    // 5. Evaluate high-level action bindings
    this.actionBindings.forEach((binding, action) => {
      let isDownNow = false;

      // Check pointer binding
      if (binding.allowPointer && this.pointerDown) {
        isDownNow = true;
      }

      // Check key bindings
      if (!isDownNow) {
        for (const key of binding.keys) {
          if (this.isKeyDown(key)) {
            isDownNow = true;
            break;
          }
        }
      }

      const wasDown = this.actionsDown.has(action);

      if (isDownNow && !wasDown) {
        this.actionsDown.add(action);
        this.actionsPressed.add(action);
      } else if (!isDownNow && wasDown) {
        this.actionsDown.delete(action);
        this.actionsReleased.add(action);
      }
    });

    // 6. Guarantee atomic action press pulses (e.g. fast sub-frame taps)
    if (this.pointerPressed) {
      this.actionsPressed.add('jump');
    }
    if (this.pointerReleased && !this.pointerDown) {
      this.actionsReleased.add('jump');
    }

    // Process explicit action down buffers
    for (const act of this.pendingActionDownBuffer) {
      this.actionsDown.add(act);
      this.actionsPressed.add(act);
    }
    this.pendingActionDownBuffer.clear();

    for (const act of this.pendingActionUpBuffer) {
      this.actionsDown.delete(act);
      this.actionsReleased.add(act);
    }
    this.pendingActionUpBuffer.clear();
  }

  /* =========================================================================
   * UNIFIED ACTION QUERIES
   * ========================================================================= */

  /**
   * Returns true if the specified action is currently being held down.
   */
  public isActionDown(action: InputAction): boolean {
    return this.actionsDown.has(action);
  }

  /**
   * Returns true only during the frame the action was initially triggered.
   */
  public isActionPressed(action: InputAction): boolean {
    return this.actionsPressed.has(action);
  }

  /**
   * Returns true only during the frame the action was released.
   */
  public isActionReleased(action: InputAction): boolean {
    return this.actionsReleased.has(action);
  }

  /* =========================================================================
   * BACKWARD-COMPATIBLE KEYBOARD QUERIES
   * ========================================================================= */

  /**
   * Returns true if the key is currently held down.
   */
  public isKeyDown(code: string): boolean {
    const normalized = this.normalizeKey(code);
    return this.keysDown.has(code) || this.keysDown.has(normalized);
  }

  /**
   * Returns true only during the first frame the key was pressed.
   */
  public isKeyPressed(code: string): boolean {
    const normalized = this.normalizeKey(code);
    return this.keysPressed.has(code) || this.keysPressed.has(normalized);
  }

  /**
   * Returns true only during the frame the key was released.
   */
  public isKeyReleased(code: string): boolean {
    const normalized = this.normalizeKey(code);
    return this.keysReleased.has(code) || this.keysReleased.has(normalized);
  }

  /* =========================================================================
   * POINTER QUERIES & STATE
   * ========================================================================= */

  /**
   * Returns true if any pointer (touch, mouse button, stylus) is currently held down.
   */
  public isPointerDown(): boolean {
    return this.pointerDown;
  }

  /**
   * Returns true only during the frame a pointer was initially pressed.
   */
  public isPointerPressed(): boolean {
    return this.pointerPressed;
  }

  /**
   * Returns true only during the frame a pointer was released.
   */
  public isPointerReleased(): boolean {
    return this.pointerReleased;
  }

  /**
   * Returns current pointer position in CSS pixels relative to viewport/canvas.
   */
  public getPointerPosition(): { x: number; y: number } {
    return { x: this.pointerClientX, y: this.pointerClientY };
  }

  /**
   * Converts client screen coordinates to canvas logical coordinate space,
   * accounting for canvas CSS bounding rect, letterboxing, scaling, and offset.
   */
  public getLogicalCoordinates(clientX: number, clientY: number, targetWidth: number = 800, targetHeight: number = 600): { x: number; y: number; onCanvas: boolean } {
    if (!this.targetElement) {
      return { x: clientX, y: clientY, onCanvas: true };
    }

    const rect = this.targetElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { x: clientX, y: clientY, onCanvas: false };
    }

    const onCanvas = (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );

    // Normalized 0..1 coordinates relative to canvas element
    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const logicalX = normX * targetWidth;
    const logicalY = normY * targetHeight;

    return { x: logicalX, y: logicalY, onCanvas };
  }

  /**
   * Returns the active pointer type ('mouse', 'touch', 'pen', 'none').
   */
  public getPointerType(): PointerType {
    return this.currentPointerType;
  }

  /**
   * Returns the count of active simultaneous pointers.
   */
  public getActivePointerCount(): number {
    return this.activePointers.size;
  }

  /* =========================================================================
   * EVENT LISTENERS & LIFECYCLE
   * ========================================================================= */

  private handleKeyDown(event: KeyboardEvent): void {
    try {
      if (this.preventDefaultForGameKeys && event.code && DEFAULT_PREVENT_KEYS.has(event.code)) {
        event.preventDefault();
      }

      const code = event.code || '';
      const key = event.key || '';
      const normalized = this.normalizeKey(key);

      if (code && !this.keysDown.has(code)) {
        this.pendingDownBuffer.add(code);
      }
      if (normalized && !this.keysDown.has(normalized)) {
        this.pendingDownBuffer.add(normalized);
      }
    } catch {
      // Ignore
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    try {
      const code = event.code || '';
      const key = event.key || '';
      const normalized = this.normalizeKey(key);

      if (code) {
        this.pendingUpBuffer.add(code);
      }
      if (normalized) {
        this.pendingUpBuffer.add(normalized);
      }
    } catch {
      // Ignore
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    try {
      const pointerType = this.normalizePointerType(event.pointerType);
      const now = performance.now();

      // Suppress simulated compatibility mouse clicks fired right after touch
      if (pointerType === 'mouse') {
        if (now - this.lastTouchTimestamp < 500) {
          return;
        }
        // Ignore non-primary mouse buttons (like right click or middle click)
        if (event.button !== 0) {
          return;
        }
      } else if (pointerType === 'touch') {
        this.lastTouchTimestamp = now;
      }

      if (this.preventDefaultOnPointer && this.targetElement) {
        event.preventDefault();
      }

      // Capture pointer only on canvas target so touch dragging doesn't steal events from UI
      if (
        this.targetElement &&
        event.target === this.targetElement &&
        'setPointerCapture' in this.targetElement &&
        typeof event.pointerId === 'number'
      ) {
        try {
          this.targetElement.setPointerCapture(event.pointerId);
        } catch {
          // Ignore
        }
      }

      this.activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
        type: pointerType,
        timestamp: now,
      });

      // Deduplicate: Only initiate a new primary jump press if no pointer was already active
      if (this.primaryPointerId === null) {
        this.primaryPointerId = event.pointerId;
        this.currentPointerType = pointerType;
        this.pointerClientX = event.clientX;
        this.pointerClientY = event.clientY;

        const coords = this.getLogicalCoordinates(event.clientX, event.clientY);
        this.pointerLogicalX = coords.x;
        this.pointerLogicalY = coords.y;

        this.isPointerPhysicallyDown = true;
        this.pointerPulsePressed = true;
        this.pointerPulseReleased = false;

        // Queue jump action press for frame-accurate jump buffering
        this.pendingActionDownBuffer.add('jump');
      } else {
        // Multi-touch: Secondary finger touched while primary is held; update coordinates without duplicate press pulse
        const primary = this.activePointers.get(this.primaryPointerId);
        if (primary) {
          this.currentPointerType = primary.type;
        }
      }
    } catch {
      // Ignore
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    try {
      const pointerType = this.normalizePointerType(event.pointerType);
      if (pointerType === 'touch') {
        this.lastTouchTimestamp = performance.now();
      }

      // Release pointer capture
      if (this.targetElement && 'releasePointerCapture' in this.targetElement && typeof event.pointerId === 'number') {
        try {
          if (this.targetElement.hasPointerCapture(event.pointerId)) {
            this.targetElement.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Ignore
        }
      }

      this.activePointers.delete(event.pointerId);

      if (this.primaryPointerId === event.pointerId) {
        if (this.activePointers.size > 0) {
          // Promote next remaining pointer to primary
          const nextPointerId = this.activePointers.keys().next().value;
          if (typeof nextPointerId === 'number') {
            this.primaryPointerId = nextPointerId;
            const nextPointer = this.activePointers.get(nextPointerId);
            if (nextPointer) {
              this.currentPointerType = nextPointer.type;
              this.pointerClientX = nextPointer.clientX;
              this.pointerClientY = nextPointer.clientY;
              const coords = this.getLogicalCoordinates(nextPointer.clientX, nextPointer.clientY);
              this.pointerLogicalX = coords.x;
              this.pointerLogicalY = coords.y;
            }
          }
        } else {
          // All pointers released
          this.primaryPointerId = null;
          this.isPointerPhysicallyDown = false;
          this.pointerPulseReleased = true;
          this.pendingActionUpBuffer.add('jump');
        }
      } else if (this.activePointers.size === 0) {
        this.primaryPointerId = null;
        this.isPointerPhysicallyDown = false;
        this.pointerPulseReleased = true;
        this.pendingActionUpBuffer.add('jump');
      }
    } catch {
      // Ignore
    }
  }

  private handlePointerCancel(event: PointerEvent): void {
    try {
      if (this.targetElement && 'releasePointerCapture' in this.targetElement && typeof event.pointerId === 'number') {
        try {
          if (this.targetElement.hasPointerCapture(event.pointerId)) {
            this.targetElement.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Ignore
        }
      }

      this.activePointers.delete(event.pointerId);

      if (this.primaryPointerId === event.pointerId) {
        if (this.activePointers.size > 0) {
          const nextPointerId = this.activePointers.keys().next().value;
          if (typeof nextPointerId === 'number') {
            this.primaryPointerId = nextPointerId;
            const nextPointer = this.activePointers.get(nextPointerId);
            if (nextPointer) {
              this.currentPointerType = nextPointer.type;
            }
          }
        } else {
          this.primaryPointerId = null;
          this.isPointerPhysicallyDown = false;
          this.pointerPulseReleased = true;
          this.pendingActionUpBuffer.add('jump');
        }
      } else if (this.activePointers.size === 0) {
        this.primaryPointerId = null;
        this.isPointerPhysicallyDown = false;
        this.pointerPulseReleased = true;
        this.pendingActionUpBuffer.add('jump');
      }
    } catch {
      // Ignore
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    try {
      const existing = this.activePointers.get(event.pointerId);
      if (existing) {
        existing.clientX = event.clientX;
        existing.clientY = event.clientY;
      }

      if (this.primaryPointerId === event.pointerId || this.primaryPointerId === null) {
        this.pointerClientX = event.clientX;
        this.pointerClientY = event.clientY;
        const coords = this.getLogicalCoordinates(event.clientX, event.clientY);
        this.pointerLogicalX = coords.x;
        this.pointerLogicalY = coords.y;
      }
    } catch {
      // Ignore
    }
  }

  private handleContextMenu(event: MouseEvent): void {
    if (this.targetElement) {
      event.preventDefault();
    }
  }

  private handleBlur(): void {
    try {
      this.reset();
    } catch {
      // Ignore
    }
  }

  /**
   * Resets all key, pointer, and action states.
   */
  public reset(): void {
    this.keysDown.clear();
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.pendingDownBuffer.clear();
    this.pendingUpBuffer.clear();

    this.actionsDown.clear();
    this.actionsPressed.clear();
    this.actionsReleased.clear();
    this.pendingActionDownBuffer.clear();
    this.pendingActionUpBuffer.clear();

    this.activePointers.clear();
    this.primaryPointerId = null;
    this.isPointerPhysicallyDown = false;
    this.pointerDown = false;
    this.pointerPressed = false;
    this.pointerReleased = false;
    this.pointerPulsePressed = false;
    this.pointerPulseReleased = false;
    this.currentPointerType = 'none';
  }

  /**
   * Disposes of all event listeners.
   */
  public destroy(): void {
    if (!this.isInitialized) return;

    try {
      const pointerTarget = this.targetElement || (typeof window !== 'undefined' ? window : null);
      if (pointerTarget) {
        pointerTarget.removeEventListener('pointerdown', this.onPointerDownBound as EventListener);
        pointerTarget.removeEventListener('pointerup', this.onPointerUpBound as EventListener);
        pointerTarget.removeEventListener('pointercancel', this.onPointerCancelBound as EventListener);
        pointerTarget.removeEventListener('pointermove', this.onPointerMoveBound as EventListener);
        pointerTarget.removeEventListener('contextmenu', this.onContextMenuBound as EventListener);
      }

      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerup', this.onPointerUpBound as EventListener);
        window.removeEventListener('pointercancel', this.onPointerCancelBound as EventListener);
        window.removeEventListener('keydown', this.onKeyDownBound as EventListener);
        window.removeEventListener('keyup', this.onKeyUpBound as EventListener);
        window.removeEventListener('blur', this.onBlurBound);
      }
    } catch {
      // Ignore
    }

    this.reset();
    this.isInitialized = false;
    Logger.debug('InputManager', 'Unified Input System destroyed.');
  }

  private normalizeKey(key: string): string {
    return key ? key.toLowerCase() : '';
  }

  private normalizePointerType(type: string): PointerType {
    if (type === 'mouse' || type === 'touch' || type === 'pen') {
      return type;
    }
    return 'unknown';
  }
}

