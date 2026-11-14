import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../context.ts';
import { IconBack } from './icons.tsx';

interface ButtonProps {
  children: ComponentChildren;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger';
  size?: 'md' | 'lg' | 'sm';
  disabled?: boolean;
  class?: string;
  autoFocus?: boolean;
  title?: string;
  /** Sound to play on activation. */
  sound?: 'click' | 'back' | 'start' | 'none';
  ariaLabel?: string;
}

export function Button({ children, onClick, variant = 'ghost', size = 'md', disabled, class: cls, autoFocus, title, sound = 'click', ariaLabel }: ButtonProps) {
  const { sound: play } = useApp();
  return (
    <button
      type="button"
      class={`btn btn--${variant} btn--${size} ${cls ?? ''}`}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      data-autofocus={autoFocus ? '' : undefined}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse' && !disabled) play('hover'); }}
      onClick={() => { if (sound !== 'none') play(sound); onClick?.(); }}
    >
      <span class="btn__label">{children}</span>
    </button>
  );
}

export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="quiet" size="sm" sound="back" onClick={onClick} class="back">
      <IconBack size={16} /> {label} <kbd>Esc</kbd>
    </Button>
  );
}

/** Label, description and an optional status note: the left side of every settings row. */
export function FieldText({ label, hint, note, tone }: { label: string; hint?: string; note?: string; tone?: 'info' | 'warn' }) {
  return (
    <span class="field__text">
      <span class="field__label">{label}</span>
      {hint && <span class="field__hint">{hint}</span>}
      {note && <span class={`field__note field__note--${tone ?? 'info'}`}>{note}</span>}
    </span>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Size of one press of the − / + buttons. Defaults to five steps. */
  nudge?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  /** Called when an adjustment ends (release, key press or nudge), with the final value. */
  onCommit?: (v: number) => void;
  hint?: string;
  note?: string;
  /** Value marked on the track as the default. */
  mark?: number;
  /** When set, the fill grows from this value instead of from the minimum (for ranges with a meaningful zero). */
  origin?: number;
  /** Dims the fill: the value is kept but is not in effect. */
  dim?: boolean;
}

export function Slider({ label, value, min = 0, max = 1, step = 0.01, nudge, format, onChange, onCommit, hint, note, mark, origin, dim }: SliderProps) {
  const unit = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));
  const at = unit(value);
  const from = origin === undefined ? 0 : unit(origin);
  const text = format ? format(value) : `${Math.round(at * 100)}`;
  const jump = nudge ?? step * 5;
  // Where a value sits along the track, allowing for the thumb staying inside it.
  const stop = (u: number) => `calc(7px + (100% - 14px) * ${u.toFixed(4)})`;
  const repeat = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(value);
  live.current = value;

  const move = (dir: number): number => {
    // Snap to the nudge grid so repeated presses land on round numbers.
    const snapped = Math.round((live.current + dir * jump) / jump) * jump;
    const next = Math.min(max, Math.max(min, Number(snapped.toFixed(4))));
    if (next !== live.current) { live.current = next; onChange(next); }
    return next;
  };
  const release = () => {
    if (repeat.current === null) return;
    clearTimeout(repeat.current);
    repeat.current = null;
    onCommit?.(live.current);
  };
  const press = (dir: number) => {
    release();
    move(dir);
    const again = () => { move(dir); repeat.current = setTimeout(again, 70); };
    repeat.current = setTimeout(again, 380);
  };
  useEffect(() => () => { if (repeat.current !== null) clearTimeout(repeat.current); }, []);

  const stepper = (dir: number, name: string) => (
    <button type="button" class="slider__step" tabIndex={-1} aria-label={`${name} ${label}`}
      disabled={dir < 0 ? value <= min : value >= max}
      onPointerDown={(e) => { e.preventDefault(); press(dir); }}
      onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
      // Activation without a pointer (assistive technology) arrives as a bare click.
      onClick={(e) => { if (e.detail === 0) onCommit?.(move(dir)); }}>
      {dir < 0 ? '−' : '+'}
    </button>
  );

  return (
    <div class="field field--slider">
      <FieldText label={label} hint={hint} note={note} />
      <span class={`slider ${dim ? 'is-dim' : ''}`} style={`--x0:${origin === undefined ? '0px' : stop(Math.min(from, at))};--x1:${stop(Math.max(from, at))};--m:${mark === undefined ? 0 : unit(mark)}`}>
        {stepper(-1, 'Lower')}
        <span class="slider__track">
          {mark !== undefined && <i class="slider__mark" aria-hidden="true" />}
          <input type="range" aria-label={label} aria-valuetext={text} min={min} max={max} step={step} value={value}
            onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))} />
        </span>
        {stepper(1, 'Raise')}
        <output class="slider__value">{text}</output>
      </span>
    </div>
  );
}

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  /** Status line under the hint, for example why the switch is held. */
  note?: string;
  tone?: 'info' | 'warn';
  /** The switch cannot be changed right now; `value` shows what is in effect. */
  locked?: boolean;
}

export function Toggle({ label, value, onChange, hint, note, tone, locked }: ToggleProps) {
  const { sound } = useApp();
  const flip = () => {
    if (locked) { sound('deny'); return; }
    sound('toggle', value ? 0 : 1);
    onChange(!value);
  };
  return (
    // The whole row is the target; the switch itself carries the semantics.
    <div class={`field field--press ${locked ? 'is-locked' : ''}`} onClick={flip}>
      <FieldText label={label} hint={hint} note={note} tone={tone} />
      <button type="button" role="switch" aria-checked={value} aria-label={label} aria-disabled={locked || undefined}
        class={`toggle ${value ? 'is-on' : ''}`} onClick={(e) => { e.stopPropagation(); flip(); }}>
        <span class="toggle__text">{value ? 'On' : 'Off'}</span>
        <span class="toggle__track"><span class="toggle__knob" /></span>
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange, hint }: {
  label: string; value: T; options: { id: T; label: string; note?: string }[]; onChange: (v: T) => void; hint?: string;
}) {
  const { sound } = useApp();
  return (
    <div class="field field--stack">
      <FieldText label={label} />
      <div class="segmented" role="radiogroup" aria-label={label} style={`--n:${options.length}`}>
        {options.map((o) => (
          <button type="button" key={o.id} role="radio" aria-checked={o.id === value} class={o.id === value ? 'is-on' : ''}
            onClick={() => { if (o.id !== value) { sound('toggle', 1); onChange(o.id); } }}>
            <b>{o.label}</b>
            {o.note && <i>{o.note}</i>}
          </button>
        ))}
      </div>
      {/* Under the control, because it describes the option that is selected. */}
      {hint && <p class="field__hint" aria-live="polite">{hint}</p>}
    </div>
  );
}

/** Thin progress line with an optional numeric caption. */
export function Meter({ value, max = 100, class: cls }: { value: number; max?: number; class?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <span class={`meter ${cls ?? ''}`} role="img" aria-label={`${Math.round(pct)} percent`}><span style={{ width: `${pct}%` }} /></span>;
}

/** Shared frame of every menu screen: header with title and back, scrollable body. */
export function ScreenFrame({ title, index, onBack, children, aside, wide }: {
  title: string; index: string; onBack: () => void; children: ComponentChildren; aside?: ComponentChildren; wide?: boolean;
}) {
  return (
    <div class={`frame ${wide ? 'frame--wide' : ''}`}>
      <header class="frame__head">
        <BackButton onClick={onBack} />
        <h1 class="frame__title"><span class="frame__index">{index}</span>{title}</h1>
        <div class="frame__aside">{aside}</div>
      </header>
      <div class="frame__body">{children}</div>
    </div>
  );
}

const DIALOG_FOCUSABLE = 'button:not([disabled]), input:not([type="hidden"]):not([hidden])';

/**
 * Modal dialog. Focus moves into it when it opens, Tab and the arrow keys
 * stay inside it, Esc calls `onClose`, and focus returns to where it was.
 */
export function Dialog({ title, eyebrow, tone, children, actions, onClose, class: cls }: {
  title: string; eyebrow?: string; tone?: 'danger'; children: ComponentChildren; actions: ComponentChildren; onClose?: () => void; class?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const before = document.activeElement as HTMLElement | null;
    (root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(DIALOG_FOCUSABLE))?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current?.();
        return;
      }
      const arrow = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key !== 'Tab' && arrow === 0) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE)).filter((el) => el.offsetParent !== null);
      // Whatever happens, these keys must not reach the screen behind the dialog.
      e.stopPropagation();
      e.preventDefault();
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const dir = e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : arrow;
      items[(i + dir + items.length) % items.length].focus();
    };
    // Capture phase on the window: the dialog answers before any screen-level shortcut does.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (before && before.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div class="dialog-scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div class={`dialog cut ${tone ? `dialog--${tone}` : ''} ${cls ?? ''}`} ref={box}>
        <header class="dialog__head">
          {eyebrow && <span class="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </header>
        <div class="dialog__body">{children}</div>
        <div class="dialog__actions">{actions}</div>
      </div>
    </div>
  );
}
