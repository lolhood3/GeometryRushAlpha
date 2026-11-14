import { useEffect, useRef, useState } from 'preact/hooks';
import { OrientationGate, canRotateForPlayer, rotateForPlayer } from '../../engine/orientation.ts';

/** The one gate for the page. Created on import so its input guard is registered before anything else listens. */
export const gate = new OrientationGate();

/**
 * Hides and disables the app itself while the block is active. Done directly
 * on the document, not through rendering, so it also holds during boot.
 */
function setAppDisabled(on: boolean): void {
  document.documentElement.classList.toggle('is-rotate-blocked', on);
  for (const id of ['ui', 'stage']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.inert = on;
    if (on) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
  }
}
setAppDisabled(gate.blocked);

/** Full-screen notice shown on a phone held upright. Renders nothing otherwise. */
export function RotateGate() {
  const [blocked, setBlocked] = useState(gate.blocked);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const focusBefore = useRef<HTMLElement | null>(null);

  useEffect(() => gate.subscribe((next) => {
    if (next) focusBefore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAppDisabled(next);
    setBlocked(next);
    if (!next) {
      setRefused(false);
      setBusy(false);
      const el = focusBefore.current;
      if (el && el.isConnected) requestAnimationFrame(() => el.focus({ preventScroll: true }));
    }
  }), []);

  useEffect(() => {
    gate.allow(blocked ? root.current : null);
    if (blocked) root.current?.focus({ preventScroll: true });
    return () => gate.allow(null);
  }, [blocked]);

  if (!blocked) return null;
  const offer = canRotateForPlayer() && !refused;
  const turn = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await rotateForPlayer();
    // On success the viewport turns and the gate lifts by itself.
    if (!ok) { setRefused(true); setBusy(false); }
    gate.check();
  };

  return (
    <div class="rotate" ref={root} role="alertdialog" aria-modal="true" aria-labelledby="rotate-title" aria-describedby="rotate-text" tabIndex={-1}>
      <div class="rotate__inner">
        <div class="rotate__icon" aria-hidden="true">
          <span class="rotate__target" />
          <span class="rotate__phone"><i /></span>
        </div>
        <span class="eyebrow">Landscape only</span>
        <h1 class="rotate__title" id="rotate-title">Rotate your device</h1>
        <p class="rotate__text" id="rotate-text">Geometry Rush requires landscape mode to deliver the intended gameplay experience.</p>
        {offer && (
          <button type="button" class="btn btn--primary btn--md rotate__btn" disabled={busy} onClick={() => void turn()}>
            <span class="btn__label">Rotate for me</span>
          </button>
        )}
        <p class="rotate__hint">
          {refused
            ? 'The browser would not turn the screen. Turn the phone sideways, and check that rotation lock is off.'
            : offer ? 'Opens fullscreen and turns the screen for you.' : 'Nothing happening? Check that rotation lock is off.'}
        </p>
      </div>
      <p class="rotate__foot">GEOMETRY RUSH <em>V.2</em></p>
    </div>
  );
}
