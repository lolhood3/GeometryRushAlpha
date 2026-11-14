import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { SfxName } from '../engine/audio/sfx.ts';
import type { Game, GameState } from '../game/game.ts';
import type { Profile } from '../game/progression/profile.ts';
import type { ProfileStore } from '../game/progression/store.ts';

export type ScreenId = 'menu' | 'levels' | 'garage' | 'records' | 'updates' | 'settings' | 'credits' | 'play';

export interface AppApi {
  game: Game;
  store: ProfileStore;
  screen: ScreenId;
  /** Switches menu screens. */
  go: (screen: ScreenId) => void;
  /** Curtain transition into a level. */
  play: (levelId: string, practice: boolean) => void;
  /** Curtain transition back to a menu screen. */
  leave: (to: ScreenId) => void;
  sound: (name: SfxName, arg?: number) => void;
  /** The level currently highlighted in menus (drives the accent colour). */
  focusLevel: string;
  setFocusLevel: (id: string) => void;
}

export const AppContext = createContext<AppApi>(null as unknown as AppApi);
export const useApp = (): AppApi => useContext(AppContext);

export function useProfile(): Profile {
  const { store } = useApp();
  const [profile, setProfile] = useState(store.profile);
  useEffect(() => {
    setProfile(store.profile);
    return store.subscribe(() => setProfile(store.profile));
  }, [store]);
  return profile;
}

export function useGameState(): GameState {
  const { game } = useApp();
  const [state, setState] = useState(game.state);
  useEffect(() => {
    setState(game.state);
    return game.subscribe(() => setState(game.state));
  }, [game]);
  return state;
}

/** Runs `fn` after every rendered game frame without re-rendering the component. */
export function useFrame(fn: () => void): void {
  const { game } = useApp();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => game.onFrame(() => ref.current()), [game]);
}

/** Calls `handler` for key presses while the component is mounted. */
export function useKey(handler: (e: KeyboardEvent) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
}

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), [data-nav]:not([disabled])';

/**
 * Arrow-key focus movement inside a container, so every menu is fully
 * playable from the keyboard. Range inputs keep their native left/right.
 */
export function useArrowNav(autoFocus = true) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (autoFocus) {
      const first = root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      const vertical = e.key === 'ArrowDown' || e.key === 'ArrowUp';
      const horizontal = e.key === 'ArrowRight' || e.key === 'ArrowLeft';
      if (!vertical && !horizontal) return;
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement && horizontal) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(`${FOCUSABLE}, input`)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      const next = items[(i + dir + items.length) % items.length] ?? items[0];
      next.focus();
      e.preventDefault();
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [autoFocus]);
  return ref;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(r).padStart(2, '0')}`;
}
