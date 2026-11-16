import { useEffect, useRef, useState } from 'preact/hooks';
import { refreshDaily, shortDate } from '../../game/levels/daily.ts';
import { DAILY_ID, getLevel, LEVEL_IDS } from '../../game/levels/index.ts';
import { MODE_NAME, previewWindow, routeOf } from '../../game/levels/route.ts';
import { challengeTally } from '../../game/progression/career.ts';
import { dailyStreak, isLevelUnlocked, levelRecord, popcount3, syncPercent, syncRank } from '../../game/progression/profile.ts';
import { Button, Meter, ScreenFrame } from '../components/controls.tsx';
import { IconCheck, IconFlag, IconLock, IconPlay, IconShard, IconStar } from '../components/icons.tsx';
import { TrackDialog } from './records/tracks.tsx';
import { RunCodeDialog } from './runcode.tsx';
import { RouteBar, RouteMix } from '../components/route.tsx';
import { formatTime, useApp, useArrowNav, useKey, useProfile } from '../context.ts';

export function LevelSelect() {
  const app = useApp();
  const profile = useProfile();
  const nav = useArrowNav(false);
  const selected = app.focusLevel;
  // Opening the list is where the daily remix moves on to a new day.
  const [today] = useState(() => refreshDaily());
  const isDaily = selected === DAILY_ID;
  const tabs: string[] = [...LEVEL_IDS, DAILY_ID];
  const level = getLevel(selected);
  const meta = level.meta;
  const rec = levelRecord(profile, selected, today.key);
  const unlocked = isLevelUnlocked(profile, selected);
  const index = tabs.indexOf(selected);
  const prev = !isDaily && index > 0 ? getLevel(LEVEL_IDS[index - 1]).meta : null;
  const source = getLevel(today.source).meta;
  const streak = dailyStreak(profile, today.key);
  const dailyRec = levelRecord(profile, DAILY_ID, today.key);
  const tally = isDaily ? null : challengeTally(rec);
  const [challenges, setChallenges] = useState<string | null>(null);
  const [runCode, setRunCode] = useState(false);

  const route = routeOf(selected);
  const shown = previewWindow(route).section;

  // The part of the track picked for practice; it belongs to the track it was picked on.
  const [pick, setPick] = useState({ id: selected, part: 0 });
  const part = pick.id === selected ? pick.part : 0;

  // Resting on an open track plays its first drop behind the menu, with its music.
  // The short wait keeps the music from stuttering while flicking through the list.
  useEffect(() => {
    if (!unlocked) { app.game.previewLevel(null); return; }
    const t = setTimeout(() => app.game.previewLevel(selected), 280);
    return () => clearTimeout(t);
  }, [selected, unlocked]);
  useEffect(() => () => app.game.previewLevel(null), []);

  // Leaving while a locked track is highlighted falls back to the last open one.
  // On a narrow screen the list scrolls sideways: keep the chosen track in view.
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rail.current?.querySelector('.level-tab.is-on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  const leaveState = useRef<{ selected: string; unlocked: boolean; open: string }>({ selected, unlocked, open: unlocked ? selected : LEVEL_IDS[0] });
  leaveState.current = { selected, unlocked, open: unlocked ? selected : leaveState.current.open };
  useEffect(() => () => {
    if (!leaveState.current.unlocked) app.setFocusLevel(leaveState.current.open);
  }, []);

  const select = (id: string) => {
    if (id === selected) return;
    app.sound('toggle', 1);
    app.setFocusLevel(id);
  };
  useKey((e) => {
    if (challenges || runCode) return;
    if (e.key === 'Escape') { app.sound('back'); app.go('menu'); }
    if (e.key === '[' || e.key === 'PageUp') select(tabs[Math.max(0, index - 1)]);
    if (e.key === ']' || e.key === 'PageDown') select(tabs[Math.min(tabs.length - 1, index + 1)]);
  });

  return (
    <div class="screen levels" ref={nav}>
      <ScreenFrame title="Levels" index="02" onBack={() => app.go('menu')} wide
        aside={<Button variant="quiet" size="sm" class="frame__action" onClick={() => setRunCode(true)}>Race a run code</Button>}>
        <div class="levels__grid">
          <div class="levels__rail" role="tablist" aria-label="Levels" ref={rail}>
            {LEVEL_IDS.map((id) => {
              const m = getLevel(id).meta;
              const r = profile.levels[id];
              const open = isLevelUnlocked(profile, id);
              return (
                <button type="button" key={id} role="tab" aria-selected={id === selected}
                  class={`level-tab ${id === selected ? 'is-on' : ''} ${open ? '' : 'is-locked'}`}
                  style={{ '--tab': m.themes[0].accent } as never}
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') app.sound('hover'); }}
                  onFocus={() => select(id)} onClick={() => select(id)}>
                  <span class="level-tab__index">{String(m.index + 1).padStart(2, '0')}</span>
                  <span class="level-tab__body">
                    <span class="level-tab__name">{m.name}</span>
                    <span class="level-tab__meta">
                      {open ? <>{m.difficulty} · {m.bpm} BPM</> : <><IconLock size={11} /> Locked</>}
                    </span>
                    <Meter value={r.best} />
                  </span>
                  <span class="level-tab__state">
                    {r.completed ? <IconCheck size={16} /> : open ? <span class="mono">{r.best}%</span> : null}
                  </span>
                </button>
              );
            })}
            <button type="button" role="tab" aria-selected={isDaily} data-daily
              class={`level-tab level-tab--daily ${isDaily ? 'is-on' : ''}`} style={{ '--tab': source.themes[0].accent } as never}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') app.sound('hover'); }}
              onFocus={() => select(DAILY_ID)} onClick={() => select(DAILY_ID)}>
              <span class="level-tab__index">{shortDate(today.key).split(' ')[0]}</span>
              <span class="level-tab__body">
                <span class="level-tab__name">Daily Remix</span>
                <span class="level-tab__meta">{source.name} · {streak > 0 ? `${streak}-day streak` : 'new today'}</span>
                <Meter value={dailyRec.best} />
              </span>
              <span class="level-tab__state">
                {dailyRec.completed ? <IconCheck size={16} /> : <span class="mono">{dailyRec.best}%</span>}
              </span>
            </button>
          </div>

          <section class="level-card cut" key={selected} aria-live="polite">
            <div class="level-card__ghost" aria-hidden="true">{isDaily ? shortDate(today.key).split(' ')[0] : String(meta.index + 1).padStart(2, '0')}</div>
            <div class="level-card__head">
              <span class="eyebrow">{isDaily ? `Daily · ${shortDate(today.key)} · ${meta.difficulty}` : `Track ${String(meta.index + 1).padStart(2, '0')} · ${meta.difficulty}`}</span>
              <h2 class="level-card__name">{meta.name}</h2>
              <p class="level-card__tagline">{isDaily ? `${source.name} with the parts of its song in a new order. A different remix every day.` : meta.tagline}</p>
            </div>

            <div class="level-card__facts">
              <div><span class="fact__k">Difficulty</span>
                <span class="pips" aria-label={`${meta.tier} of 5`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} class={n <= meta.tier ? 'is-on' : ''} />)}</span></div>
              <div><span class="fact__k">Tempo</span><span class="fact__v mono">{meta.bpm}<small> BPM</small></span></div>
              <div><span class="fact__k">Length</span><span class="fact__v mono">{formatTime(level.endBeat * level.beatDur)}</span></div>
              {isDaily
                ? <div><span class="fact__k">Streak</span><span class="fact__v mono">{streak}<small> {streak === 1 ? 'day' : 'days'}</small></span></div>
                : <div><span class="fact__k">Reward</span><span class="fact__v mono star"><IconStar size={14} /> {meta.stars}</span></div>}
            </div>

            <div class="level-card__route">
              <div class="level-card__route-head">
                <span class="fact__k">{unlocked ? 'Route · pick a part to practise it' : 'Route'}</span>
                {unlocked && <span class="level-card__now mono"><i aria-hidden="true" />Previewing {route.sections[shown].name}</span>}
              </div>
              <RouteBar route={route} selected={part} marks={{ best: rec.completed ? 0 : rec.best / 100 }}
                onSelect={unlocked ? (i) => { app.sound('toggle', 1); setPick({ id: selected, part: i }); } : undefined} />
              <RouteMix route={route} extra={meta.mechanics.filter((m) => !(MODE_NAME as readonly string[]).includes(m))} />
            </div>

            {unlocked ? (
              <>
                <div class="level-card__progress">
                  <div class="prog">
                    <span class="prog__k">Normal</span><Meter value={rec.best} /><span class="prog__v mono">{rec.best}%</span>
                  </div>
                  <div class="prog prog--practice">
                    <span class="prog__k">Practice</span><Meter value={rec.practiceBest} /><span class="prog__v mono">{rec.practiceBest}%</span>
                  </div>
                  <div class="level-card__records">
                    {!isDaily && (
                      <span class="shards" aria-label={`${popcount3(rec.shards)} of 3 shards`}>
                        {[0, 1, 2].map((i) => <IconShard key={i} size={18} filled={(rec.shards & (1 << i)) !== 0} class={(rec.shards & (1 << i)) ? 'is-on' : ''} />)}
                      </span>
                    )}
                    <span class="rec"><i>Sync</i><b>{rec.bestSync >= 0 ? `${syncRank(rec.bestSync)} · ${syncPercent(rec.bestSync)}%` : '—'}</b></span>
                    <span class="rec"><i>{isDaily ? 'Attempts today' : 'Attempts'}</i><b>{rec.attempts}</b></span>
                    {isDaily
                      ? <span class="rec"><i>Days cleared</i><b>{profile.daily.clears}</b></span>
                      : <span class="rec"><i>Clears</i><b>{rec.completions}</b></span>}
                    {tally && (
                      <button type="button" class="rec rec--link" data-challenges onClick={() => { app.sound('click'); setChallenges(selected); }}
                        aria-label={`Challenges: ${tally.done} of ${tally.of} done. Show them.`}>
                        <i>Challenges</i><b>{tally.done}<small>/{tally.of}</small></b>
                      </button>
                    )}
                  </div>
                </div>
                <div class="level-card__actions">
                  <Button variant="primary" size="lg" sound="start" autoFocus onClick={() => app.play(selected, false)}>
                    <IconPlay size={18} /> Play
                  </Button>
                  <Button variant="ghost" size="lg" sound="start" onClick={() => app.play(selected, true, part)}
                    title={part > 0 ? 'Start at this part, with checkpoints' : 'Checkpoints, no pressure'}>
                    {part > 0 ? <><IconFlag size={16} /> Practice · {route.sections[part].name}</> : 'Practice'}
                  </Button>
                </div>
              </>
            ) : (
              <div class="level-card__locked">
                <IconLock size={22} />
                <div>
                  <b>Locked</b>
                  <p>Clear <em>{prev?.name}</em> in Normal or Practice mode to open this track.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </ScreenFrame>
      {challenges && (
        <TrackDialog id={challenges} profile={profile} onClose={() => setChallenges(null)}
          onMove={(id) => { setChallenges(id); app.setFocusLevel(id); }} />
      )}
      {runCode && <RunCodeDialog onClose={() => setRunCode(false)} />}
    </div>
  );
}
