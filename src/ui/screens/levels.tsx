import { useEffect, useRef } from 'preact/hooks';
import { getLevel, LEVEL_IDS } from '../../game/levels/index.ts';
import { isLevelUnlocked, popcount3, syncPercent, syncRank } from '../../game/progression/profile.ts';
import { Button, Meter, ScreenFrame } from '../components/controls.tsx';
import { IconCheck, IconLock, IconPlay, IconShard, IconStar } from '../components/icons.tsx';
import { formatTime, useApp, useArrowNav, useKey, useProfile } from '../context.ts';

export function LevelSelect() {
  const app = useApp();
  const profile = useProfile();
  const nav = useArrowNav(false);
  const selected = app.focusLevel;
  const level = getLevel(selected);
  const meta = level.meta;
  const rec = profile.levels[selected];
  const unlocked = isLevelUnlocked(profile, selected);
  const index = (LEVEL_IDS as readonly string[]).indexOf(selected);
  const prev = index > 0 ? getLevel(LEVEL_IDS[index - 1]).meta : null;

  useEffect(() => {
    if (unlocked) app.game.setAttractLevel(selected);
  }, [selected, unlocked]);

  // Leaving while a locked track is highlighted falls back to the last open one.
  const leaveState = useRef({ selected, unlocked, open: unlocked ? selected : LEVEL_IDS[0] });
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
    if (e.key === 'Escape') { app.sound('back'); app.go('menu'); }
    if (e.key === '[' || e.key === 'PageUp') select(LEVEL_IDS[Math.max(0, index - 1)]);
    if (e.key === ']' || e.key === 'PageDown') select(LEVEL_IDS[Math.min(LEVEL_IDS.length - 1, index + 1)]);
  });

  return (
    <div class="screen levels" ref={nav}>
      <ScreenFrame title="Levels" index="02" onBack={() => app.go('menu')} wide>
        <div class="levels__grid">
          <div class="levels__rail" role="tablist" aria-label="Levels">
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
          </div>

          <section class="level-card cut" key={selected} aria-live="polite">
            <div class="level-card__ghost" aria-hidden="true">{String(meta.index + 1).padStart(2, '0')}</div>
            <div class="level-card__head">
              <span class="eyebrow">Track {String(meta.index + 1).padStart(2, '0')} · {meta.difficulty}</span>
              <h2 class="level-card__name">{meta.name}</h2>
              <p class="level-card__tagline">{meta.tagline}</p>
            </div>

            <div class="level-card__facts">
              <div><span class="fact__k">Difficulty</span>
                <span class="pips" aria-label={`${meta.tier} of 5`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} class={n <= meta.tier ? 'is-on' : ''} />)}</span></div>
              <div><span class="fact__k">Tempo</span><span class="fact__v mono">{meta.bpm}<small> BPM</small></span></div>
              <div><span class="fact__k">Length</span><span class="fact__v mono">{formatTime(level.endBeat * level.beatDur)}</span></div>
              <div><span class="fact__k">Reward</span><span class="fact__v mono star"><IconStar size={14} /> {meta.stars}</span></div>
            </div>

            <div class="chips">{meta.mechanics.map((m) => <span key={m} class="chip">{m}</span>)}</div>

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
                    <span class="shards" aria-label={`${popcount3(rec.shards)} of 3 shards`}>
                      {[0, 1, 2].map((i) => <IconShard key={i} size={18} filled={(rec.shards & (1 << i)) !== 0} class={(rec.shards & (1 << i)) ? 'is-on' : ''} />)}
                    </span>
                    <span class="rec"><i>Sync</i><b>{rec.bestSync >= 0 ? `${syncRank(rec.bestSync)} · ${syncPercent(rec.bestSync)}%` : '—'}</b></span>
                    <span class="rec"><i>Attempts</i><b>{rec.attempts}</b></span>
                    <span class="rec"><i>Clears</i><b>{rec.completions}</b></span>
                  </div>
                </div>
                <div class="level-card__actions">
                  <Button variant="primary" size="lg" sound="start" autoFocus onClick={() => app.play(selected, false)}>
                    <IconPlay size={18} /> Play
                  </Button>
                  <Button variant="ghost" size="lg" sound="start" onClick={() => app.play(selected, true)} title="Checkpoints, no pressure">
                    Practice
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
    </div>
  );
}
