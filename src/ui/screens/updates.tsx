import { useEffect, useRef, useState } from 'preact/hooks';
import {
  CATEGORY_KEYS, ERAS, LATEST_RELEASE, RELEASES, eraInfo, formatReleaseDate, releaseSections,
} from '../../game/updates/index.ts';
import { Button, ScreenFrame } from '../components/controls.tsx';
import { IconArrow, IconBack } from '../components/icons.tsx';
import { useApp, useArrowNav, useKey, useProfile } from '../context.ts';

/** "2.1.0" → "2.1": the short form used for the large outlined numerals. */
const shortVersion = (v: string) => v.split('.').slice(0, v.endsWith('.0') ? 2 : 3).join('.');
const pad2 = (n: number) => String(n).padStart(2, '0');

export function Updates() {
  const app = useApp();
  const profile = useProfile();
  const nav = useArrowNav();
  const root = useRef<HTMLDivElement>(null);
  // What was unread on arrival keeps its "New" label for the whole visit.
  const arrivedUnread = useRef(app.store.unreadNews().map((r) => r.id)).current;
  const [selected, setSelected] = useState(() => arrivedUnread[0] ?? LATEST_RELEASE.id);

  const index = Math.max(0, RELEASES.findIndex((r) => r.id === selected));
  const release = RELEASES[index];
  const era = eraInfo(release.era);
  const sections = releaseSections(release);
  const newer = RELEASES[index - 1];
  const older = RELEASES[index + 1];

  useEffect(() => { app.store.markReleaseViewed(release.id); }, [release.id]);

  const select = (id: string, focusTab = false) => {
    if (id !== selected) {
      app.sound('toggle', 1);
      setSelected(id);
    }
    requestAnimationFrame(() => {
      const el = root.current;
      if (!el) return;
      const body = el.querySelector<HTMLElement>('.frame__body');
      if (id !== selected && body) body.scrollTop = 0;
      const tab = el.querySelector<HTMLElement>(`[data-release="${id}"]`);
      if (!tab) return;
      if (focusTab) tab.focus({ preventScroll: true });
      const rail = tab.closest<HTMLElement>('.news__rail');
      // Only the horizontal (small-screen) rail needs to follow the selection.
      if (rail && rail.scrollWidth > rail.clientWidth) {
        const t = tab.getBoundingClientRect();
        const left = rail.scrollLeft + t.left - rail.getBoundingClientRect().left - (rail.clientWidth - t.width) / 2;
        rail.scrollTo({ left, behavior: 'smooth' });
      }
    });
  };

  useKey((e) => {
    if (e.key === 'Escape') { app.sound('back'); app.go('menu'); }
    if (e.key === '[' && newer) select(newer.id, true);
    if (e.key === ']' && older) select(older.id, true);
  });

  const viewed = profile.news.viewed;
  return (
    <div class="screen news" ref={(el) => { root.current = el; nav.current = el; }}>
      <ScreenFrame title="Updates & News" index="05" onBack={() => app.go('menu')} wide
        aside={<span class="frame__meta mono">Installed · v{__APP_VERSION__}</span>}>
        <div class="news__grid">
          <nav class="news__rail" role="tablist" aria-label="Releases">
            {ERAS.map((group) => {
              const list = RELEASES.filter((r) => r.era === group.id);
              if (list.length === 0) return null;
              return (
                <div class="news__group" key={group.id} role="presentation">
                  <span class="news__group-label">{group.label}</span>
                  <div class="news__tabs" role="presentation">{list.map((r) => (
                    <button type="button" key={r.id} role="tab" aria-selected={r.id === selected} data-release={r.id}
                      data-autofocus={r.id === selected ? '' : undefined}
                      class={`level-tab rel-tab cat--${CATEGORY_KEYS[r.category]} ${r.id === selected ? 'is-on' : ''}`}
                      onPointerEnter={(e) => { if (e.pointerType === 'mouse') app.sound('hover'); }}
                      onFocus={() => select(r.id)} onClick={() => select(r.id)}>
                      <span class="level-tab__index rel-tab__ver">{shortVersion(r.version)}</span>
                      <span class="level-tab__body">
                        <span class="level-tab__name">{r.title}</span>
                        <span class="level-tab__meta">{r.category} · {formatReleaseDate(r.date)}</span>
                      </span>
                      <span class="level-tab__state">
                        {!viewed.includes(r.id) && <i class="rel-tab__dot" role="img" aria-label="Unread" />}
                      </span>
                    </button>
                  ))}</div>
                </div>
              );
            })}
          </nav>

          <article class={`level-card release cut cat--${CATEGORY_KEYS[release.category]}`} key={release.id} aria-live="polite">
            <div class="level-card__ghost" aria-hidden="true">{shortVersion(release.version)}</div>
            <header class="release__head">
              <span class="eyebrow">{era.label}{release.label ? ` · ${release.label}` : ''}</span>
              <h2 class="level-card__name release__title">{release.title}</h2>
              <p class="release__meta">
                <span class="cat-badge">{release.category}</span>
                <span class="release__ver mono">v{release.version}</span>
                <time class="release__date" dateTime={release.date}>{formatReleaseDate(release.date, true)}</time>
                {release.id === LATEST_RELEASE.id && <span class="release__flag">Latest</span>}
                {arrivedUnread.includes(release.id) && <span class="badge">New</span>}
              </p>
            </header>

            <p class="release__desc">{release.description}</p>
            {era.note && <p class="release__note">{era.note}</p>}

            <div class="release__sections">
              {sections.map((s) => (
                <section class={`notes notes--${s.kind}`} key={s.title}>
                  <h3 class="notes__title">{s.title}<span class="mono">{pad2(s.items.length)}</span></h3>
                  <ul class="notes__list">{s.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
              ))}
            </div>

            <footer class="release__pager">
              <Button variant="quiet" size="sm" sound="none" disabled={!newer} onClick={() => newer && select(newer.id, true)}
                ariaLabel={newer ? `Newer release, version ${newer.version}` : 'No newer release'}>
                <IconBack size={15} /> Newer
              </Button>
              <span class="release__count mono">{pad2(index + 1)} / {pad2(RELEASES.length)}</span>
              <Button variant="quiet" size="sm" sound="none" disabled={!older} onClick={() => older && select(older.id, true)}
                ariaLabel={older ? `Older release, version ${older.version}` : 'No older release'}>
                Older <IconArrow size={15} />
              </Button>
            </footer>
          </article>
        </div>
      </ScreenFrame>
    </div>
  );
}
