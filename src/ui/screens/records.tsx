import { getLevel, LEVEL_IDS, TOTAL_SHARDS } from '../../game/levels/index.ts';
import { ACHIEVEMENTS } from '../../game/progression/achievements.ts';
import { CHASSIS, PAINTS, TRAILS, isUnlocked, starsEarned, totalStars } from '../../game/progression/cosmetics.ts';
import { completedCount, isLevelUnlocked, popcount3, syncRank, totalShards } from '../../game/progression/profile.ts';
import { Meter, ScreenFrame } from '../components/controls.tsx';
import { IconCheck, IconLock, IconShard } from '../components/icons.tsx';
import { formatTime, useApp, useArrowNav, useKey, useProfile } from '../context.ts';

export function Records() {
  const app = useApp();
  const p = useProfile();
  const nav = useArrowNav();
  useKey((e) => { if (e.key === 'Escape') { app.sound('back'); app.go('menu'); } });
  const t = p.totals;
  const sync = t.actions > 0 ? Math.round((t.synced / t.actions) * 100) : 0;
  const all = [...CHASSIS, ...PAINTS, ...TRAILS];
  const owned = all.filter((c) => isUnlocked(c.unlock, p)).length;
  const done = Object.keys(p.achievements).length;
  const tiles: [string, string, string?][] = [
    ['Levels cleared', `${completedCount(p)}`, `of ${LEVEL_IDS.length}`],
    ['Stars', `${starsEarned(p)}`, `of ${totalStars()}`],
    ['Shards', `${totalShards(p)}`, `of ${TOTAL_SHARDS}`],
    ['Cosmetics', `${owned}`, `of ${all.length}`],
    ['Attempts', t.attempts.toLocaleString()],
    ['Crashes', t.deaths.toLocaleString()],
    ['Jumps', t.jumps.toLocaleString()],
    ['Orbs · pads', `${t.orbs.toLocaleString()} · ${t.pads.toLocaleString()}`],
    ['On-beat accuracy', `${sync}%`, t.actions > 0 ? `rank ${syncRank(sync / 100)}` : undefined],
    ['Time in levels', formatTime(t.playSeconds)],
  ];

  return (
    <div class="screen records" ref={nav}>
      <ScreenFrame title="Records" index="04" onBack={() => app.go('menu')} wide
        aside={<span class="frame__meta mono">{done}/{ACHIEVEMENTS.length} achievements</span>}>
        <section class="block">
          <h2 class="block__title">Career</h2>
          <div class="tiles">
            {tiles.map(([k, v, sub]) => (
              <div class="tile" key={k}><span class="tile__k">{k}</span><span class="tile__v mono">{v}</span>{sub && <span class="tile__sub">{sub}</span>}</div>
            ))}
          </div>
        </section>

        <section class="block">
          <h2 class="block__title">Tracks</h2>
          <div class="table" role="table">
            <div class="table__row table__row--head" role="row">
              <span>Track</span><span>Best</span><span>Practice</span><span>Shards</span><span>Sync</span><span>Streak</span><span>Attempts</span>
            </div>
            {LEVEL_IDS.map((id) => {
              const m = getLevel(id).meta;
              const r = p.levels[id];
              const open = isLevelUnlocked(p, id);
              return (
                <div class={`table__row ${open ? '' : 'is-locked'}`} role="row" key={id} style={{ '--tab': m.themes[0].accent } as never}>
                  <span class="table__name"><i class="mono">{String(m.index + 1).padStart(2, '0')}</i>{m.name}{!open && <IconLock size={12} />}</span>
                  <span class="mono">{r.completed ? <b class="ok">100%</b> : `${r.best}%`}</span>
                  <span class="mono">{r.practiceBest}%</span>
                  <span class="shards shards--sm">{[0, 1, 2].map((i) => <IconShard key={i} size={13} filled={(r.shards & (1 << i)) !== 0} class={(r.shards & (1 << i)) ? 'is-on' : ''} />)}
                    <em class="sr">{popcount3(r.shards)} of 3</em></span>
                  <span class="mono">{r.bestSync >= 0 ? `${syncRank(r.bestSync)} ${Math.round(r.bestSync * 100)}%` : '—'}</span>
                  <span class="mono">{r.bestStreak > 0 ? `×${r.bestStreak}` : '—'}</span>
                  <span class="mono">{r.attempts}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section class="block">
          <h2 class="block__title">Achievements</h2>
          <div class="achievements">
            {ACHIEVEMENTS.map((a) => {
              const got = a.id in p.achievements;
              const [cur, goal] = a.progress(p);
              const reward = all.find((c) => c.unlock.kind === 'achievement' && c.unlock.id === a.id);
              return (
                <div class={`achievement ${got ? 'is-done' : ''}`} key={a.id}>
                  <span class="achievement__mark">{got ? <IconCheck size={16} /> : <span class="mono">{Math.floor((cur / goal) * 100)}</span>}</span>
                  <span class="achievement__body">
                    <b>{a.name}</b>
                    <i>{a.description}</i>
                    {reward && <em>Reward · {reward.name}</em>}
                  </span>
                  {goal > 1 && <span class="achievement__prog"><Meter value={cur} max={goal} /><span class="mono">{cur.toLocaleString()}/{goal.toLocaleString()}</span></span>}
                </div>
              );
            })}
          </div>
        </section>
      </ScreenFrame>
    </div>
  );
}
