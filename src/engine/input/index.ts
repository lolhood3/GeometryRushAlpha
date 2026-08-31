/**
 * Rush Engine Input system contracts and types for keyboard, mouse, gamepad, and touch controls.
 */

export type KeyCode = string;
export type InputAction = 'jump' | 'restart' | 'pause' | string;
export type PointerType = 'mouse' | 'touch' | 'pen' | 'unknown' | 'none';

export interface PointerState {
  x: number;
  y: number;
  isDown: boolean;
  type: PointerType;
  id: number | null;
  activeCount: number;
}

export interface IInputManager {
  init(target?: Window | HTMLElement): void;
  update(): void;
  destroy(): void;
  reset(): void;

  // Backward-compatible keyboard methods
  isKeyDown(code: string): boolean;
  isKeyPressed(code: string): boolean;
  isKeyReleased(code: string): boolean;

  // Unified Action methods
  isActionDown(action: InputAction): boolean;
  isActionPressed(action: InputAction): boolean;
  isActionReleased(action: InputAction): boolean;
  bindAction(action: InputAction, keys: string[], options?: { allowPointer?: boolean }): void;

  // Pointer state queries
  isPointerDown(): boolean;
  isPointerPressed(): boolean;
  isPointerReleased(): boolean;
  getPointerPosition(): { x: number; y: number };
  getPointerType(): PointerType;
  getActivePointerCount(): number;
}

export * from './InputManager.ts';
export * from './HapticsManager.ts';

