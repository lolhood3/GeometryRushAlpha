import { useEffect, useRef, useState } from 'preact/hooks';
import {
  ACTIONS, bindKey, clearKey, defaultBindings, isBindable, keyLabel, sameBindings, type ActionId,
} from '../../../game/progression/keys.ts';
import { FieldText } from '../../components/controls.tsx';
import { useApp, useProfile } from '../../context.ts';
import { Group, type Notify } from './parts.tsx';

const actionName = (id: ActionId) => ACTIONS.find((a) => a.id === id)!.label;

/**
 * Keyboard remapping. Selecting a key cap listens for the next key press and
 * binds it; the bindings are read by the input system and the play screen, so
 * a change is live as soon as it is made.
 */
export function KeyBindingsGroup({ notify }: { notify: Notify }) {
  const app = useApp();
  const { store } = app;
  const keys = useProfile().settings.keys;
  const [listen, setListen] = useState<{ action: ActionId; slot: number } | null>(null);
  const [status, setStatus] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  /** A key press that binds Space must not also "click" the focused key cap. */
  const quietUntil = useRef(0);

  useEffect(() => {
    if (!listen) return;
    const stop = () => setListen(null);
    const onKey = (e: KeyboardEvent) => {
      // While listening, no key may reach the game, the menus or the browser.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      const current = store.profile.settings.keys;
      const name = actionName(listen.action);
      if (e.key === 'Escape') { app.sound('back'); setStatus(null); stop(); return; }
      if (e.code === 'Backspace' || e.code === 'Delete') {
        if (listen.slot < current[listen.action].length) {
          const removed = current[listen.action][listen.slot];
          store.updateSettings({ keys: clearKey(current, listen.action, listen.slot) });
          app.sound('toggle', 0);
          setStatus({ tone: 'info', text: `${keyLabel(removed)} removed from ${name}.` });
        }
        stop();
        return;
      }
      if (!isBindable(e.code)) {
        app.sound('deny');
        setStatus({ tone: 'warn', text: 'That key is reserved. Enter, Tab, Alt and the function keys cannot be bound. Press another key, or Esc to cancel.' });
        return;
      }
      const { bindings, movedFrom } = bindKey(current, listen.action, listen.slot, e.code);
      store.updateSettings({ keys: bindings });
      quietUntil.current = performance.now() + 400;
      app.sound('equip');
      setStatus({
        tone: movedFrom ? 'warn' : 'info',
        text: movedFrom ? `${keyLabel(e.code)} now belongs to ${name}. It was taken from ${actionName(movedFrom)}.` : `${keyLabel(e.code)} bound to ${name}.`,
      });
      stop();
    };
    const onPointer = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el || typeof el.closest !== 'function' || !el.closest('.keycap')) stop();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('blur', stop);
    };
  }, [listen]);

  const select = (action: ActionId, slot: number, e: MouseEvent) => {
    if (e.detail === 0 && performance.now() < quietUntil.current) return;
    const same = listen && listen.action === action && listen.slot === slot;
    app.sound('click');
    setStatus(null);
    setListen(same ? null : { action, slot });
  };

  const isDefault = sameBindings(keys, defaultBindings());
  const resetKeys = () => {
    const before = keys;
    store.updateSettings({ keys: defaultBindings() });
    setListen(null);
    setStatus(null);
    notify({ tone: 'ok', text: 'Key bindings restored to defaults.', action: { label: 'Undo', run: () => { store.updateSettings({ keys: before }); notify({ tone: 'ok', text: 'Key bindings put back.' }); } } });
  };

  const listeningFor = listen ? actionName(listen.action) : '';
  return (
    <Group title="Keyboard" aside={
      <button type="button" class="set-link" disabled={isDefault} onClick={() => { app.sound('click'); resetKeys(); }}>Reset keys</button>
    }>
      {ACTIONS.map((a) => {
        const bound = keys[a.id];
        const adding = listen?.action === a.id && listen.slot >= bound.length;
        return (
          <div class="field field--bind" key={a.id}>
            <FieldText label={a.label} hint={a.hint} />
            <div class="bind">
              <div class="bind__keys">
                {bound.map((code, slot) => {
                  const on = listen?.action === a.id && listen.slot === slot;
                  return (
                    <button type="button" key={code} class={`keycap ${on ? 'is-listening' : ''}`}
                      aria-label={on ? `Press a key for ${a.label}` : `${a.label}: ${keyLabel(code)}. Select to change.`}
                      onClick={(e) => select(a.id, slot, e)}>
                      {on ? 'Press a key' : keyLabel(code)}
                    </button>
                  );
                })}
                {bound.length === 0 && !adding && <span class="bind__none">No key</span>}
                {(bound.length < a.slots || adding) && (
                  <button type="button" class={`keycap keycap--add ${adding ? 'is-listening' : ''}`}
                    aria-label={adding ? `Press a key for ${a.label}` : `Add a key for ${a.label}`}
                    onClick={(e) => select(a.id, bound.length, e)}>
                    {adding ? 'Press a key' : '+'}
                  </button>
                )}
              </div>
              {a.fixed.length > 0 && <span class="bind__fixed">Always · {a.fixed.join(' · ')}</span>}
            </div>
          </div>
        );
      })}
      <p class={`bind-status ${listen ? 'is-live' : ''} ${status?.tone === 'warn' ? 'is-warn' : ''}`} role="status" aria-live="polite">
        {status
          ? status.text
          : listen
            ? `Press a key for ${listeningFor}. Esc cancels, Backspace removes the key.`
            : 'Select a key to change it. Touch, mouse, gamepad and Esc are fixed.'}
      </p>
    </Group>
  );
}
