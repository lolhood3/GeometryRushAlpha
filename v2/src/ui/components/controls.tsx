import type { ComponentChildren } from 'preact';
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

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}

export function Slider({ label, value, min = 0, max = 1, step = 0.01, format, onChange, hint }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label class="field">
      <span class="field__text">
        <span class="field__label">{label}</span>
        {hint && <span class="field__hint">{hint}</span>}
      </span>
      <span class="slider">
        <input type="range" min={min} max={max} step={step} value={value} style={`--fill:${pct}%`}
          onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))} />
        <output class="slider__value">{format ? format(value) : `${Math.round(pct)}`}</output>
      </span>
    </label>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const { sound } = useApp();
  return (
    <div class="field">
      <span class="field__text">
        <span class="field__label">{label}</span>
        {hint && <span class="field__hint">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={value} aria-label={label} class={`toggle ${value ? 'is-on' : ''}`}
        onClick={() => { sound('toggle', value ? 0 : 1); onChange(!value); }}>
        <span class="toggle__knob" />
        <span class="toggle__text">{value ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange, hint }: {
  label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; hint?: string;
}) {
  const { sound } = useApp();
  return (
    <div class="field">
      <span class="field__text">
        <span class="field__label">{label}</span>
        {hint && <span class="field__hint">{hint}</span>}
      </span>
      <div class="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button type="button" key={o.id} role="radio" aria-checked={o.id === value} class={o.id === value ? 'is-on' : ''}
            onClick={() => { sound('toggle', 1); onChange(o.id); }}>{o.label}</button>
        ))}
      </div>
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

export function Dialog({ title, children, actions }: { title: string; children: ComponentChildren; actions: ComponentChildren }) {
  return (
    <div class="dialog-scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div class="dialog cut">
        <h2>{title}</h2>
        <div class="dialog__body">{children}</div>
        <div class="dialog__actions">{actions}</div>
      </div>
    </div>
  );
}
