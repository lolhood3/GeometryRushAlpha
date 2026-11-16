import { useEffect, useState } from 'preact/hooks';

/**
 * The game as an installed app: registers the service worker that keeps an
 * offline copy, and holds on to the browser's offer to install it.
 */
export interface AppStatus {
  /** A copy of the game is saved on this device and it starts without a connection. */
  offline: boolean;
  /** The browser has offered to install the game and the offer can be shown now. */
  canInstall: boolean;
  /** Running as an installed app rather than in a browser tab. */
  installed: boolean;
  /** An iPhone or iPad, where installing is done from the Share menu. */
  ios: boolean;
}

interface InstallOffer extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const mq = (q: string): boolean => typeof matchMedia === 'function' && matchMedia(q).matches;

function detectInstalled(): boolean {
  return mq('(display-mode: fullscreen)') || mq('(display-mode: standalone)')
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

let status: AppStatus = { offline: false, canInstall: false, installed: false, ios: false };
let offer: InstallOffer | null = null;
const listeners = new Set<() => void>();

function update(patch: Partial<AppStatus>): void {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

/** Call once at start-up. Does nothing in development, where a saved copy would only get in the way. */
export function startApp(): void {
  update({ installed: detectInstalled(), ios: detectIos() });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e as InstallOffer;
    update({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    update({ canInstall: false, installed: true });
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = (): void => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* No offline copy; the game still runs. */ });
    void navigator.serviceWorker.ready.then(() => update({ offline: true })).catch(() => {});
  };
  // After the page has loaded, so saving the offline copy never competes with starting the game.
  if (document.readyState === 'complete') register(); else window.addEventListener('load', register, { once: true });
}

/** Shows the browser's install dialog. Resolves to whether the player accepted. */
export async function installApp(): Promise<boolean> {
  const o = offer;
  if (!o) return false;
  offer = null;
  update({ canInstall: false });
  try {
    await o.prompt();
    return (await o.userChoice).outcome === 'accepted';
  } catch {
    return false;
  }
}

export function useAppStatus(): AppStatus {
  const [s, set] = useState(status);
  useEffect(() => {
    const l = (): void => set(status);
    listeners.add(l);
    l();
    return () => { listeners.delete(l); };
  }, []);
  return s;
}
