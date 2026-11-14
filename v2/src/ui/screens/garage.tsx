import { useEffect, useState } from 'preact/hooks';
import { achievementName } from '../../game/progression/achievements.ts';
import {
  CHASSIS, PAINTS, TRAILS, findChassis, findPaint, findTrail, isUnlocked, unlockProgress, unlockText, type Unlock,
} from '../../game/progression/cosmetics.ts';
import type { Loadout } from '../../game/progression/profile.ts';
import { ChassisIcon } from '../components/chassis.tsx';
import { Meter, ScreenFrame } from '../components/controls.tsx';
import { IconCheck, IconLock } from '../components/icons.tsx';
import { useApp, useArrowNav, useKey, useProfile } from '../context.ts';

type Tab = 'chassis' | 'primary' | 'secondary' | 'trail';
const TABS: { id: Tab; label: string }[] = [
  { id: 'chassis', label: 'Chassis' },
  { id: 'primary', label: 'Primary' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'trail', label: 'Trail' },
];

interface Item { id: string; name: string; blurb: string; unlock: Unlock }

export function Garage() {
  const app = useApp();
  const profile = useProfile();
  const nav = useArrowNav();
  const [tab, setTab] = useState<Tab>('chassis');
  const [hover, setHover] = useState<string | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const lo = profile.loadout;
  useKey((e) => { if (e.key === 'Escape') { app.sound('back'); app.go('menu'); } });

  // Opening a tab acknowledges its new unlocks.
  useEffect(() => {
    const prefix = tab === 'chassis' ? 'chassis:' : tab === 'trail' ? 'trail:' : 'paint:';
    const keys = app.store.unseen().filter((k) => k.startsWith(prefix));
    if (keys.length === 0) return;
    const t = setTimeout(() => app.store.markSeen(keys), 1400);
    return () => clearTimeout(t);
  }, [tab, profile]);

  const unseen = app.store.unseen();
  const items: Item[] = tab === 'chassis' ? CHASSIS
    : tab === 'trail' ? TRAILS
    : PAINTS.map((p) => ({ ...p, blurb: p.hex.toUpperCase() }));
  const equippedId = lo[tab];
  const previewId = hover ?? equippedId;
  const preview = items.find((i) => i.id === previewId) ?? items[0];
  const previewOpen = isUnlocked(preview.unlock, profile);
  const [cur, goal] = unlockProgress(preview.unlock, profile);

  // The big preview always reflects what the highlighted item would look like.
  const shown: Loadout = { ...lo, [tab]: previewId };
  const chassis = findChassis(shown.chassis);
  const primary = findPaint(shown.primary).hex;
  const secondary = findPaint(shown.secondary).hex;
  const trail = findTrail(shown.trail);

  const choose = (item: Item) => {
    if (app.store.equip(tab, item.id)) {
      app.sound('equip');
      setDenied(null);
    } else {
      app.sound('deny');
      setDenied(item.id);
      setHover(item.id);
    }
  };
  const newIn = (t: Tab) => unseen.filter((k) => k.startsWith(t === 'chassis' ? 'chassis:' : t === 'trail' ? 'trail:' : 'paint:')).length;

  return (
    <div class="screen garage" ref={nav}>
      <ScreenFrame title="Garage" index="03" onBack={() => app.go('menu')} wide>
        <div class="garage__grid">
          <section class="showcase cut" style={{ '--p': primary, '--s': secondary } as never}>
            <div class="showcase__stage">
              <span class={`showcase__trail showcase__trail--${trail.id}`} />
              <ChassisIcon chassis={chassis} primary={primary} secondary={secondary} size="100%" class="showcase__icon" />
            </div>
            <div class="showcase__info">
              <span class="eyebrow">{TABS.find((t) => t.id === tab)!.label}</span>
              <h2>{preview.name}</h2>
              <p>{preview.blurb}</p>
              {previewOpen ? (
                <span class={`state ${preview.id === equippedId ? 'state--on' : ''}`}>
                  {preview.id === equippedId ? <><IconCheck size={14} /> Equipped</> : 'Unlocked · select to equip'}
                </span>
              ) : (
                <div class={`lockline ${denied === preview.id ? 'is-denied' : ''}`}>
                  <span><IconLock size={13} /> {unlockText(preview.unlock, achievementName)}</span>
                  {goal > 1 && <><Meter value={cur} max={goal} /><span class="mono">{cur}/{goal}</span></>}
                </div>
              )}
            </div>
            <dl class="showcase__loadout">
              <div><dt>Chassis</dt><dd>{findChassis(lo.chassis).name}</dd></div>
              <div><dt>Primary</dt><dd><i style={{ background: findPaint(lo.primary).hex }} />{findPaint(lo.primary).name}</dd></div>
              <div><dt>Secondary</dt><dd><i style={{ background: findPaint(lo.secondary).hex }} />{findPaint(lo.secondary).name}</dd></div>
              <div><dt>Trail</dt><dd>{findTrail(lo.trail).name}</dd></div>
            </dl>
          </section>

          <section class="locker">
            <div class="tabs" role="tablist">
              {TABS.map((t) => (
                <button type="button" key={t.id} role="tab" aria-selected={t.id === tab} class={t.id === tab ? 'is-on' : ''}
                  onClick={() => { app.sound('toggle', 1); setTab(t.id); setHover(null); setDenied(null); }}>
                  {t.label}{newIn(t.id) > 0 && <span class="dot" />}
                </button>
              ))}
            </div>
            <div class={`swatches swatches--${tab === 'chassis' ? 'chassis' : tab === 'trail' ? 'trail' : 'paint'}`}
              onPointerLeave={() => setHover(null)}>
              {items.map((item) => {
                const open = isUnlocked(item.unlock, profile);
                const on = item.id === equippedId;
                const isNew = unseen.includes(`${tab === 'chassis' ? 'chassis' : tab === 'trail' ? 'trail' : 'paint'}:${item.id}`);
                return (
                  <button type="button" key={item.id} class={`swatch ${on ? 'is-on' : ''} ${open ? '' : 'is-locked'}`}
                    aria-pressed={on} aria-label={`${item.name}${open ? '' : ' (locked)'}`}
                    data-autofocus={on ? '' : undefined}
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setHover(item.id); app.sound('hover'); } }}
                    onFocus={() => setHover(item.id)}
                    onClick={() => choose(item)}>
                    {tab === 'chassis' && (
                      <ChassisIcon chassis={findChassis(item.id)} primary={findPaint(lo.primary).hex} secondary={findPaint(lo.secondary).hex} size={52} locked={!open} />
                    )}
                    {(tab === 'primary' || tab === 'secondary') && <span class="swatch__paint" style={{ background: findPaint(item.id).hex }} />}
                    {tab === 'trail' && <span class={`swatch__trail showcase__trail--${item.id}`} style={{ '--p': primary, '--s': secondary } as never} />}
                    <span class="swatch__name">{item.name}</span>
                    {!open && <IconLock class="swatch__lock" size={13} />}
                    {on && <IconCheck class="swatch__check" size={13} />}
                    {isNew && open && <span class="swatch__new">New</span>}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </ScreenFrame>
    </div>
  );
}
