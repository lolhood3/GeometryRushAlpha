import { useEffect, useRef, useState } from 'preact/hooks';
import { CATEGORY_KEYS, formatReleaseDate } from '../../game/updates/index.ts';
import { useApp, useKey } from '../context.ts';
import { Button } from './controls.tsx';
import { IconClose } from './icons.tsx';

/**
 * Main-menu notice for a release the player has not been told about. It is
 * owed once per release: dismissing it, opening the notes or simply moving on
 * from the menu all settle it.
 */
export function WhatsNew() {
  const app = useApp();
  // Decided once per visit so the notice does not vanish under the player mid-transition.
  const [release] = useState(() => app.store.pendingNews());
  const [state, setState] = useState<'open' | 'closing' | 'closed'>('open');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const earlier = useRef(release ? app.store.unreadNews().length - 1 : 0).current;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (release) app.store.acknowledgeNews();
  }, []);

  const dismiss = () => {
    if (state !== 'open') return;
    app.store.acknowledgeNews();
    setState('closing');
    timer.current = setTimeout(() => setState('closed'), 200);
  };
  useKey((e) => {
    if (e.key === 'Escape' && release && state === 'open') { app.sound('back'); dismiss(); }
  });

  if (!release || state === 'closed') return null;
  return (
    <aside class={`whatsnew cut cat--${CATEGORY_KEYS[release.category]} ${state === 'closing' ? 'is-closing' : ''}`} aria-label="What's new">
      <div class="whatsnew__head">
        <span class="eyebrow">What's new</span>
        <span class="whatsnew__ver mono">v{release.version}</span>
        <button type="button" class="whatsnew__close" aria-label="Dismiss" onClick={() => { app.sound('back'); dismiss(); }}>
          <IconClose size={14} />
        </button>
      </div>
      <h2 class="whatsnew__title">{release.title}</h2>
      <p class="whatsnew__meta"><span class="cat-badge">{release.category}</span><time dateTime={release.date}>{formatReleaseDate(release.date)}</time></p>
      <p class="whatsnew__text">{release.description}</p>
      <div class="whatsnew__actions">
        <Button variant="primary" size="sm" onClick={() => { app.store.acknowledgeNews(); app.go('updates'); }}>
          <span class="whatsnew__long">Read the notes</span><span class="whatsnew__short" aria-hidden="true">Read</span>
        </Button>
        {earlier > 0 && <span class="whatsnew__more">+{earlier} earlier {earlier === 1 ? 'update' : 'updates'}</span>}
      </div>
    </aside>
  );
}
