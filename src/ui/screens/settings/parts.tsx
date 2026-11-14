import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { IconCheck, IconClose } from '../../components/icons.tsx';

/** A titled run of related rows. No box: a caption, a hairline and the rows. */
export function Group({ title, aside, children }: { title: string; aside?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="set-group" aria-label={title}>
      <header class="set-group__head">
        <h3 class="set-group__title">{title}</h3>
        <span class="set-group__rule" />
        {aside && <span class="set-group__aside">{aside}</span>}
      </header>
      <div class="set-group__rows">{children}</div>
    </section>
  );
}

/** A plain row: text on the left, any control on the right. */
export function Row({ children, class: cls }: { children: ComponentChildren; class?: string }) {
  return <div class={`field ${cls ?? ''}`}>{children}</div>;
}

export interface Notice {
  tone: 'ok' | 'warn' | 'error';
  text: string;
  action?: { label: string; run: () => void };
}
export type Notify = (notice: Notice) => void;

/** One status message at a time, replaced by the next and cleared after a while. */
export function useNotice(): { notice: (Notice & { id: number }) | null; notify: Notify; dismiss: () => void } {
  const [notice, setNotice] = useState<(Notice & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useRef(0);
  const dismiss = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setNotice(null);
  }, []);
  const notify = useCallback<Notify>((n) => {
    if (timer.current !== null) clearTimeout(timer.current);
    setNotice({ ...n, id: ++id.current });
    // Errors and anything that can be undone stay up longer.
    timer.current = setTimeout(() => setNotice(null), n.tone === 'ok' && !n.action ? 4500 : 9000);
  }, []);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  return { notice, notify, dismiss };
}

export function NoticeBar({ notice, onDismiss }: { notice: (Notice & { id: number }) | null; onDismiss: () => void }) {
  return (
    <div class="set-notice-slot" role="status" aria-live="polite">
      {notice && (
        <div class={`set-notice set-notice--${notice.tone}`} key={notice.id}>
          <span class="set-notice__mark" aria-hidden="true">{notice.tone === 'ok' ? <IconCheck size={13} /> : '!'}</span>
          <span class="set-notice__text">{notice.text}</span>
          {notice.action && (
            <button type="button" class="set-notice__action" onClick={() => { notice.action!.run(); }}>{notice.action.label}</button>
          )}
          <button type="button" class="set-notice__close" tabIndex={-1} aria-label="Dismiss" onClick={onDismiss}><IconClose size={13} /></button>
        </div>
      )}
    </div>
  );
}
