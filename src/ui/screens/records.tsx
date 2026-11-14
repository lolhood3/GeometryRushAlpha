import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ACHIEVEMENTS } from '../../game/progression/achievements.ts';
import { achievementViews, newUnlocks, seenKey } from '../../game/progression/career.ts';
import { ScreenFrame } from '../components/controls.tsx';
import { useApp, useArrowNav, useKey, useProfile } from '../context.ts';
import { AchievementCenter, AchievementDialog } from './records/achievements.tsx';
import { CareerPanel } from './records/career.tsx';
import { TrackDialog, TrackTable } from './records/tracks.tsx';

type Open = { kind: 'achievement'; id: string; list: string[] } | { kind: 'track'; id: string } | null;

export function Records() {
  const app = useApp();
  const p = useProfile();
  const nav = useArrowNav();
  const [open, setOpen] = useState<Open>(null);
  useKey((e) => { if (e.key === 'Escape') { app.sound('back'); app.go('menu'); } });

  const views = useMemo(() => achievementViews(p), [p]);
  const done = views.filter((v) => v.status === 'completed').length;

  // Unlocks the player has not looked at yet are flagged for this visit, then counted as seen.
  const fresh = useRef<string[] | null>(null);
  if (fresh.current === null) fresh.current = newUnlocks(p);
  useEffect(() => () => {
    const ids = fresh.current ?? [];
    if (ids.length > 0) app.store.markSeen(ids.map(seenKey));
  }, []);

  const all = ACHIEVEMENTS.map((a) => a.id);
  const shown = open?.kind === 'achievement' ? views.find((v) => v.def.id === open.id) : undefined;
  const move = (dir: 1 | -1) => {
    if (open?.kind !== 'achievement') return;
    const i = open.list.indexOf(open.id);
    setOpen({ ...open, id: open.list[(i + dir + open.list.length) % open.list.length] });
  };

  return (
    <div class="screen records" ref={nav}>
      <ScreenFrame title="Records" index="04" onBack={() => app.go('menu')} wide
        aside={<span class="frame__meta mono">{done}/{ACHIEVEMENTS.length} achievements</span>}>
        <CareerPanel profile={p} onAchievement={(id) => setOpen({ kind: 'achievement', id, list: all })} onTrack={(id) => setOpen({ kind: 'track', id })} />
        <TrackTable profile={p} onOpen={(id) => setOpen({ kind: 'track', id })} />
        <AchievementCenter views={views} profile={p} fresh={fresh.current} onOpen={(id, list) => setOpen({ kind: 'achievement', id, list })} />
      </ScreenFrame>
      {shown && open?.kind === 'achievement' && (
        <AchievementDialog v={shown} profile={p} position={[open.list.indexOf(open.id), open.list.length]} onMove={move} onClose={() => setOpen(null)} />
      )}
      {open?.kind === 'track' && (
        <TrackDialog id={open.id} profile={p} onClose={() => setOpen(null)} onMove={(id) => setOpen({ kind: 'track', id })} />
      )}
    </div>
  );
}
