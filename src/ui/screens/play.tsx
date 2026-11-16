import { useEffect, useRef, useState } from 'preact/hooks';
import { daily } from '../../game/levels/daily.ts';
import { DAILY_ID, getLevel, LEVEL_IDS } from '../../game/levels/index.ts';
import { routeOf, sectionAt } from '../../game/levels/route.ts';
import { INTRO_STEPS, type IntroView } from '../../game/onboarding.ts';
import { achievementName, findAchievement } from '../../game/progression/achievements.ts';
import { milestones, trackChallenges } from '../../game/progression/career.ts';
import { cosmeticName } from '../../game/progression/cosmetics.ts';
import { keyLabel } from '../../game/progression/keys.ts';
import { isLevelUnlocked, levelRecord, popcount3, syncPercent, type Profile } from '../../game/progression/profile.ts';
import type { RunResult } from '../../game/game.ts';
import { Button } from '../components/controls.tsx';
import { IconArrow, IconBack, IconCheck, IconFlag, IconPause, IconPlay, IconRetry, IconShard, IconStar, IconUndo } from '../components/icons.tsx';
import { copyText } from '../clipboard.ts';
import { RouteBar } from '../components/route.tsx';
import { useApp, useArrowNav, useFrame, useGameState, useKey, useProfile } from '../context.ts';
import { Emblem } from './records/emblems.tsx';
import { SettingsPanel } from './settings.tsx';

/** The record of the level on screen. For the daily remix that is today's. */
function recordOf(profile: Profile, id: string) {
  return levelRecord(profile, id, id === DAILY_ID ? daily().key : '');
}

function PauseMenu() {
  const app = useApp();
  const st = useGameState();
  const nav = useArrowNav();
  const [settings, setSettings] = useState(false);
  const meta = getLevel(st.levelId).meta;
  const route = routeOf(st.levelId);
  const rec = recordOf(useProfile(), st.levelId);
  // Start on the part that matters most: where the last crash was, else where the player is now.
  const here = st.lastDeath >= 0 ? sectionAt(route, st.lastDeath).index : sectionAt(route, app.game.live.progress).index;
  const [part, setPart] = useState(here);
  const chosen = route.sections[part];
  const from = st.practice && st.section > 0 ? route.sections[st.section] : null;
  return (
    <div class="overlay pause" ref={nav}>
      <div class={`pause__panel cut ${settings ? 'pause__panel--settings' : ''}`}>
        <span class="eyebrow">Paused · {st.practice ? (from ? `Practice from ${from.name}` : 'Practice') : 'Normal'}</span>
        <h2>{meta.name}</h2>
        <p class="pause__pct mono">{Math.floor(app.game.live.progress * 100)}%<small> · attempt {st.attempt}</small></p>
        {settings ? (
          <>
            <SettingsPanel sections={['audio', 'video', 'gameplay', 'access']} compact />
            <Button variant="quiet" sound="back" onClick={() => setSettings(false)}>Done</Button>
          </>
        ) : (
          <div class="pause__actions">
            <Button variant="primary" size="lg" autoFocus onClick={() => app.game.resume()}><IconPlay size={16} /> Resume</Button>
            <Button onClick={() => app.game.restart()}><IconRetry size={16} /> Restart</Button>
            <Button class="pause__wide" onClick={() => app.game.restart(!st.practice)}>
              <IconFlag size={15} /> {st.practice ? 'Switch to Normal' : 'Switch to Practice'}
            </Button>
            <Button onClick={() => setSettings(true)}>Settings</Button>
            <Button variant="quiet" sound="back" onClick={() => app.leave('levels')}>Exit to levels</Button>
            {st.coach && <Button variant="quiet" onClick={() => app.game.endIntro()}>Skip the intro</Button>}
          </div>
        )}
        {!settings && route.sections.length > 1 && (
          <div class="pause__parts">
            <span class="pause__parts-k">Practise a part</span>
            <RouteBar route={route} selected={part} onSelect={(i) => { app.sound('toggle', 1); setPart(i); }}
              marks={{ best: st.practice || rec.completed ? 0 : rec.best / 100, crash: st.lastDeath }} label="Choose a part to practise" />
            <Button size="sm" sound="start" onClick={() => app.game.practiceFrom(part)}>
              <IconFlag size={14} /> {part === 0 ? 'Practice from the start' : `Practice from ${chosen.name}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Results({ result }: { result: RunResult }) {
  const app = useApp();
  const profile = useProfile();
  const nav = useArrowNav();
  const level = getLevel(result.levelId);
  const meta = level.meta;
  const o = result.outcome;
  const isDaily = result.levelId === DAILY_ID;
  const nextId = meta.index >= 0 ? LEVEL_IDS[meta.index + 1] : undefined;
  const next = nextId && isLevelUnlocked(profile, nextId) ? getLevel(nextId).meta : null;
  const rec = recordOf(profile, result.levelId);
  const from = result.section > 0 ? routeOf(result.levelId).sections[result.section] : null;
  // Only the five tracks bank shards and have challenges: the daily remix and a level being play-tested do not.
  const isTrack = (LEVEL_IDS as readonly string[]).includes(result.levelId);
  const missing = isTrack ? 3 - popcount3(rec.shards) : 0;
  const closest = milestones(profile).closest;
  const challenges = isTrack ? trackChallenges(rec) : [];
  // Offered once the shards are in: the first challenge of this track still open.
  const open = missing === 0 ? challenges.find((c) => !c.complete) : undefined;

  // A Normal run from the start can be handed on as a code. `copied` is the outcome of the last try.
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  // The best Normal run on record for this track. After a Normal clear there always is one; after a Practice clear there may not be.
  const bestRun = app.game.bestRun();
  const share = () => {
    const code = app.game.runCode();
    if (!code) { setCopied('no'); return; }
    void copyText(code).then((ok) => setCopied(ok ? 'yes' : 'no'));
  };

  const rewards: { k: string; v: string }[] = [];
  if (!result.practice && o.firstCompletion && meta.stars > 0) rewards.push({ k: 'Stars', v: `+${meta.stars}` });
  if (o.newShards > 0) rewards.push({ k: 'Shards banked', v: `+${o.newShards}` });
  if (o.dailyStreak > 0) rewards.push({ k: 'Daily streak', v: o.dailyStreak === 1 ? '1 day' : `${o.dailyStreak} days` });
  // The clear itself is the headline, so it is not listed again as a challenge.
  for (const id of o.challenges) {
    const c = challenges.find((x) => x.id === id);
    if (c && id !== 'clear') rewards.push({ k: 'Challenge', v: c.done });
  }
  if (o.unlockedLevel) rewards.push({ k: 'Track unlocked', v: getLevel(o.unlockedLevel).meta.name });
  for (const c of o.cosmetics) rewards.push({ k: 'Unlocked', v: cosmeticName(c) });
  for (const a of o.achievements) rewards.push({ k: 'Achievement', v: achievementName(a) });

  return (
    <div class="overlay results" ref={nav}>
      <div class="results__panel cut">
        <span class="eyebrow">{from ? `Practice from ${from.name}` : result.practice ? 'Practice clear' : isDaily ? (o.dailyStreak > 0 ? "Today's remix cleared" : 'Remix cleared again') : o.firstCompletion ? 'First clear' : 'Track cleared'}</span>
        <h2 class="results__title">{meta.name}</h2>
        <div class="results__stats">
          <div class="results__rank" data-rank={result.rank}>
            <span class="results__letter">{result.rank}</span>
            <span><b class="mono">{syncPercent(result.syncRate)}%</b><i>on beat</i></span>
          </div>
          <div class="stat"><i>Attempts</i><b class="mono">{result.attempts}</b></div>
          <div class="stat"><i>Best streak</i><b class="mono">×{result.bestStreak}</b></div>
          <div class="stat"><i>Shards</i>
            <span class="shards">{[0, 1, 2].map((i) => (
              <IconShard key={i} size={20} filled={(result.shards & (1 << i)) !== 0} class={(result.shards & (1 << i)) ? 'is-on pop' : ''} />
            ))}</span>
          </div>
        </div>

        {from ? (
          <p class="results__note">{isDaily
            ? `You reached the end from ${from.name}. Only a Normal run from the start counts towards the daily streak.`
            : `You reached the end from ${from.name}. A run that starts part-way is not a Practice clear: play from the start to open the next track.`}</p>
        ) : result.practice ? (
          <p class="results__note">{isDaily
            ? 'Practice does not count towards the daily streak. Clear it in Normal mode to tick off today.'
            : 'Practice clears open the next track, but stars, shards and records are only earned in Normal mode.'}</p>
        ) : isDaily ? (
          <p class="results__note">{getLevel(daily().source).meta.name}, rearranged. The remix keeps no stars or shards, and a new one arrives tomorrow.</p>
        ) : null}

        {rewards.length > 0 && (
          <ul class="rewards">
            {rewards.map((r, i) => (
              <li key={i} style={{ animationDelay: `${0.25 + i * 0.09}s` }}>
                {r.k === 'Stars' ? <IconStar size={14} /> : <span class="rewards__dot" />}<i>{r.k}</i><b>{r.v}</b>
              </li>
            ))}
          </ul>
        )}

        {(missing > 0 || open || closest) && (
          <div class="next" aria-label="What to go for next">
            <span class="next__k">Still to get</span>
            {missing > 0 && (
              <button type="button" class="next__row" data-next="shards" onClick={() => { app.sound('start'); app.game.restart(false, 0); }}>
                <span class="shards next__icon" aria-hidden="true">
                  {[0, 1, 2].map((i) => <IconShard key={i} size={15} filled={(rec.shards & (1 << i)) !== 0} class={(rec.shards & (1 << i)) ? 'is-on' : ''} />)}
                </span>
                <span class="next__text">
                  <b>{missing === 1 ? '1 shard still hidden here' : `${missing} shards still hidden here`}</b>
                  <i>{result.practice ? 'Shards are only kept from a Normal run that reaches the end.' : 'Pick them up and finish the run to keep them.'}</i>
                </span>
                <span class="next__go"><IconRetry size={14} /> Retry</span>
              </button>
            )}
            {open && (
              <button type="button" class="next__row" data-next="challenge"
                onClick={() => { app.sound('start'); app.game.restart(open.id === 'practice', 0); }}>
                <span class="next__icon next__icon--flag" aria-hidden="true"><IconFlag size={16} /></span>
                <span class="next__text">
                  <b>{open.goal}</b>
                  <i>{open.how}</i>
                </span>
                {open.status && <span class="next__prog"><span class="mono">{open.status}</span></span>}
                <span class="next__go"><IconRetry size={14} /> {open.id === 'practice' ? 'Practice' : 'Retry'}</span>
              </button>
            )}
            {closest && (
              <button type="button" class="next__row" data-next="achievement" onClick={() => { app.sound('click'); app.leave('records'); }}>
                <span class="next__icon"><Emblem id={closest.def.id} status="progress" size="sm" /></span>
                <span class="next__text">
                  <b>{closest.def.name}</b>
                  <i>{closest.def.description}</i>
                </span>
                <span class="next__prog">
                  <span class="next__bar"><i style={{ width: `${Math.max(2, closest.percent)}%` }} /></span>
                  <span class="mono">{closest.current.toLocaleString('en-US')}<i>/{closest.goal.toLocaleString('en-US')}</i></span>
                </span>
                <span class="next__go">Records <IconArrow size={14} /></span>
              </button>
            )}
          </div>
        )}

        <div class="results__actions">
          {result.practice
            ? <Button variant="primary" size="lg" autoFocus sound="start" onClick={() => app.game.restart(false)}><IconPlay size={16} /> Play for real</Button>
            : next
              ? <Button variant="primary" size="lg" autoFocus sound="start" onClick={() => app.play(next.id, false)}><IconPlay size={16} /> Next · {next.name}</Button>
              : isDaily
                ? <Button variant="primary" size="lg" autoFocus onClick={() => app.leave('levels')}>Back to levels</Button>
                : <Button variant="primary" size="lg" autoFocus onClick={() => app.leave('records')}>View records</Button>}
          <Button onClick={() => app.game.restart()}><IconRetry size={16} /> {from ? `Again from ${from.name}` : 'Play again'}</Button>
          {bestRun && (
            <Button class="results__watch" onClick={() => app.game.watchBest()}
              title={bestRun.completed
                ? `Plays your best run of this track back: cleared, ${Math.round(bestRun.sync * 100)}% on the beat.`
                : `Plays your best Normal run of this track back: it reached ${bestRun.percent}%.`}>
              <IconPlay size={14} /> Watch best run
            </Button>
          )}
          {!result.practice && (
            <Button onClick={share} title="Copies a code for this run. Anyone can paste it under Levels to replay it and race it.">
              {copied === 'yes' ? <><IconCheck size={14} /> Code copied</> : copied === 'no' ? 'Could not copy' : 'Copy run code'}
            </Button>
          )}
          {o.cosmetics.length > 0 && <Button onClick={() => app.leave('garage')}>Garage</Button>}
          {!(isDaily && !result.practice) && <Button variant="quiet" sound="back" onClick={() => app.leave('levels')}>Levels</Button>}
        </div>
      </div>
    </div>
  );
}

export function PlayScreen() {
  const app = useApp();
  const { game } = app;
  const st = useGameState();
  const settings = useProfile().settings;
  const meta = getLevel(st.levelId).meta;
  const rec = recordOf(useProfile(), st.levelId);
  const route = routeOf(st.levelId);
  const coachBeat = useRef<HTMLElement>(null);
  // While the crash is on screen the marker stays on the best that was just beaten, so the gain can be seen.
  const prevBest = st.phase === 'dead' && st.newBest ? st.bestBefore : rec.best;
  const bar = useRef<HTMLSpanElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const streak = useRef<HTMLDivElement>(null);
  const streakN = useRef<HTMLSpanElement>(null);
  const perf = useRef<HTMLDivElement>(null);
  const timing = useRef<HTMLDivElement>(null);
  const timingTick = useRef<HTMLElement>(null);
  const timingLabel = useRef<HTMLElement>(null);
  const last = useRef({ pct: -1, streak: -1, frame: 0, timing: game.live.timing.seq });

  useFrame(() => {
    const lv = game.live;
    const l = last.current;
    if (bar.current) bar.current.style.transform = `scaleX(${lv.progress.toFixed(4)})`;
    const p = Math.floor(lv.progress * 100);
    if (p !== l.pct && pct.current) { l.pct = p; pct.current.textContent = `${p}%`; }
    if (lv.streak !== l.streak && streak.current && streakN.current) {
      const up = lv.streak > l.streak;
      l.streak = lv.streak;
      // Keep the last number while the counter fades out, so it never reads ×0.
      if (lv.streak >= 2) streakN.current.textContent = String(lv.streak);
      streak.current.classList.toggle('is-live', lv.streak >= 2);
      if (up && lv.streak >= 2) {
        streak.current.classList.remove('bump');
        void streak.current.offsetWidth;
        streak.current.classList.add('bump');
      }
    }
    if (lv.timing.seq !== l.timing) {
      l.timing = lv.timing.seq;
      const el = timing.current;
      if (el && timingTick.current && timingLabel.current) {
        const t = timingCue(lv.timing.off, lv.timing.hit);
        timingLabel.current.textContent = t.label;
        timingTick.current.style.left = `${t.at.toFixed(1)}%`;
        el.dataset.timing = t.kind;
        el.classList.remove('is-shown');
        void el.offsetWidth;
        el.classList.add('is-shown');
      }
    }
    if (coachBeat.current) coachBeat.current.style.transform = `rotate(45deg) scale(${(0.7 + Math.min(1, lv.pulse) * 0.6).toFixed(3)})`;
    if (perf.current && (l.frame++ & 15) === 0) {
      perf.current.textContent = `${Math.round(lv.fps)} FPS · ${lv.resolution} · ${lv.instances} quads · ${lv.particles} particles · effects ${Math.round(lv.effects * 100)}%`;
    }
  });

  const keys = settings.keys;
  useKey((e) => {
    if (e.repeat) return;
    // While a menu is up, keys that move or activate its buttons keep that job even if they are bound to an action.
    const menuOpen = st.phase === 'paused' || st.phase === 'results';
    const bound = (codes: string[]) => codes.includes(e.code) && !(menuOpen && (e.code === 'Space' || e.code.startsWith('Arrow')));
    if (e.key === 'Escape' || bound(keys.pause)) {
      if (document.querySelector('.dialog-scrim')) return;
      if (st.phase === 'paused') game.resume();
      else if (st.phase === 'replay') game.stopWatch();
      else if (st.phase === 'results') app.leave('levels');
      else game.pause();
      e.preventDefault();
    } else if (bound(keys.restart) && st.phase !== 'paused' && st.phase !== 'won') {
      game.restart();
    } else if (bound(keys.checkpoint) && st.practice && st.phase !== 'replay') {
      game.removeCheckpoint();
    }
  });

  // The cue card hides itself after a few beats.
  const [cueShown, setCueShown] = useState<number>(0);
  useEffect(() => {
    if (!st.cue) return;
    setCueShown(st.cue.id);
    const t = setTimeout(() => setCueShown(0), 2600);
    return () => clearTimeout(t);
  }, [st.cue?.id]);

  const playing = st.phase === 'running' || st.phase === 'countdown';
  // The best run being played back from the results screen: a recording, so the HUD says so and offers the way out.
  const watching = st.phase === 'replay';
  const best = watching ? game.bestRun() : null;
  // On-screen prompts name the key the player actually has bound to jump.
  const jumpKey = keys.jump.length ? keyLabel(keys.jump[0]) : '';
  const cueSub = (text: string) => (keys.jump.includes('Space') ? text : text.replace(/Space( · )?/, jumpKey ? `${jumpKey}$1` : ''));
  return (
    <div class={`screen play ${settings.highContrast ? 'is-contrast' : ''}`} style={{ '--accent': meta.themes[0].accent } as never}>
      <div class={`hud ${st.phase === 'results' || st.phase === 'won' ? 'is-hidden' : ''}`}>
        {settings.showProgress && (
          <div class="hud__progress">
            <span ref={bar} />
            {route.sections.slice(1).map((s) => <i key={s.index} class="hud__tick" style={{ left: `${(s.start * 100).toFixed(2)}%` }} />)}
            {!watching && !st.practice && !rec.completed && prevBest > 0 && <i class="hud__mark hud__mark--best" style={{ left: `${prevBest}%` }} />}
            {!watching && st.practice && st.section > 0 && <i class="hud__mark hud__mark--from" style={{ left: `${(route.sections[st.section].cursor.snap.x / getLevel(st.levelId).endX * 100).toFixed(2)}%` }} />}
            {!watching && st.practice && st.marks.map((m, i) => <i key={i} class={`hud__mark hud__mark--cp ${i === st.marks.length - 1 ? 'is-last' : ''}`} style={{ left: `${(m * 100).toFixed(2)}%` }} />)}
            {!watching && st.lastDeath >= 0 && <i class="hud__mark hud__mark--crash" key={`d${st.attempt}`} style={{ left: `${(st.lastDeath * 100).toFixed(2)}%` }} />}
          </div>
        )}
        <div class="hud__top">
          {watching
            ? <button type="button" class="icon-btn hud__pause" tabIndex={-1} aria-label="Back to results" onClick={() => game.stopWatch()}><IconBack size={18} /></button>
            : (
              <button type="button" class="icon-btn hud__pause" tabIndex={-1} aria-label="Pause"
                onClick={() => (st.phase === 'paused' ? game.resume() : game.pause())}>
                <IconPause size={18} />
              </button>
            )}
          <div class="hud__title">
            <b>{meta.name}</b>
            {watching
              ? <i><em class="tag tag--watch">Best run</em>{best ? (best.completed ? `Cleared · ${Math.round(best.sync * 100)}% on the beat` : `Reached ${best.percent}%`) : 'Replay'}</i>
              : <i>{st.practice && <em class="tag">{st.section > 0 ? `Practice · ${route.sections[st.section].name}` : 'Practice'}</em>}{st.rival && !st.practice && <em class="tag tag--rival">Racing a shared run</em>}Attempt {st.attempt}</i>}
          </div>
          <div class="hud__right">
            <span class="shards hud__shards" aria-label="Shards">
              {[0, 1, 2].map((i) => <IconShard key={i} size={16} filled={(st.shards & (1 << i)) !== 0} class={(st.shards & (1 << i)) ? 'is-on pop' : ''} />)}
            </span>
            {settings.showProgress && <span class="hud__pct mono" ref={pct}>0%</span>}
          </div>
        </div>

        {settings.showSync && (
          <div class="hud__streak" ref={streak}>
            <span class="hud__streak-n mono">×<span ref={streakN}>0</span></span>
            <span class="hud__streak-k">On beat</span>
          </div>
        )}

        {settings.showTiming && playing && !st.coach && (
          <div class="hud__timing" ref={timing} aria-hidden="true">
            <span class="hud__timing-bar"><i ref={timingTick} /></span>
            <b ref={timingLabel} />
          </div>
        )}

        {st.coach && playing && (
          <Coach view={st.coach} jumpKey={jumpKey} beat={coachBeat} onSkip={() => { app.sound('back'); game.endIntro(); }} />
        )}

        {st.cue && cueShown === st.cue.id && playing && !st.coach && (
          <div class="cue" key={st.cue.id}>
            <b>{st.cue.text}</b>
            {st.cue.sub && <i>{cueSub(st.cue.sub)}</i>}
          </div>
        )}

        {st.phase === 'countdown' && st.countdown > 0 && <div class="countdown mono" key={st.countdown}>{st.countdown}</div>}

        {st.phase === 'dead' && (
          <div class="death" key={st.attempt}>
            <b class="mono">{st.deathPct}%</b>
            {st.newBest && <i>New best{st.deathPct > st.bestBefore && st.bestBefore > 0 ? ` · +${st.deathPct - st.bestBefore}%` : ''}</i>}
            <span class="death__where mono">
              {st.lastDeath >= 0 && route.sections.length > 1 && <em>{sectionAt(route, st.lastDeath).name}</em>}
              {!st.practice && !st.newBest && !rec.completed && rec.best > st.deathPct && <em>Best {rec.best}%</em>}
            </span>
            {st.awaitRetry && <span class="death__retry">{jumpKey ? `Tap or press ${jumpKey} to retry` : 'Tap to retry'}</span>}
          </div>
        )}

        {watching && (
          <div class="hud__watch">
            <Button size="sm" sound="back" onClick={() => game.stopWatch()}>Back to results</Button>
          </div>
        )}

        {st.practice && !watching && (
          <div class="hud__practice">
            <span class="mono"><IconFlag size={13} /> {st.checkpoints}</span>
            <button type="button" class="icon-btn" tabIndex={-1} disabled={st.checkpoints === 0} aria-label="Remove last checkpoint"
              title={keys.checkpoint.length ? `Remove last checkpoint (${keyLabel(keys.checkpoint[0])})` : 'Remove last checkpoint'} onClick={() => game.removeCheckpoint()}>
              <IconUndo size={16} />
            </button>
          </div>
        )}
        {settings.showFps && <div class="hud__perf mono" ref={perf} />}
      </div>

      {st.phase === 'paused' && <PauseMenu />}
      {st.phase === 'results' && st.result && <Results result={st.result} key={st.attempt} />}
    </div>
  );
}

/**
 * What the timing cue says about one action. `off` is its distance from the
 * nearest 8th note in beats, negative when early; the furthest it can be is a
 * quarter of a beat, which is the edge of the meter.
 */
export function timingCue(off: number, hit: boolean): { kind: 'hit' | 'early' | 'late'; label: string; at: number } {
  const at = Math.max(0, Math.min(100, 50 + (off / 0.25) * 50));
  if (hit) return { kind: 'hit', label: 'On beat', at };
  return off < 0 ? { kind: 'early', label: 'Early', at } : { kind: 'late', label: 'Late', at };
}

const coarse = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** The guided intro: one short lesson at a time, ticked off when the player does it. */
function Coach({ view, jumpKey, beat, onSkip }: { view: IntroView; jumpKey: string; beat: { current: HTMLElement | null }; onSkip: () => void }) {
  const touch = coarse();
  const press = touch ? 'Tap the screen' : jumpKey ? `Press ${jumpKey}` : 'Click';
  const hold = touch ? 'Keep your finger down' : jumpKey ? `Hold ${jumpKey}` : 'Hold the button';
  const id = INTRO_STEPS[view.step].id;
  const copy = {
    jump: { title: 'Jump', ask: `${press} to jump over the spikes.`, done: 'Good. That is the only button there is.' },
    beat: { title: 'On the beat', ask: 'Jump in time with the kick drum. A white burst means you were on the beat.', done: 'Streak started. Jumps on the beat raise your sync rank.' },
    shards: { title: 'Shards', ask: 'Three shards hide on every track. Pick them up and finish the run to keep them.', done: 'Three shards hide on every track. Pick them up and finish the run to keep them.' },
    hold: { title: 'Hold', ask: `${hold} to keep hopping across rows of spikes and pits.`, done: 'That is it. A held jump repeats once every beat.' },
  }[id];
  const ticked = view.done && id !== 'shards';
  return (
    <div class={`coach ${ticked ? 'is-done' : ''}`} role="status" data-step={id}>
      <span class="coach__mark" aria-hidden="true">
        {ticked ? <IconCheck size={16} />
          : id === 'shards' ? <IconShard size={16} filled class="is-on" />
            : id === 'beat' ? <i class="coach__beat" ref={beat as never} />
              : <span class="mono">{view.step + 1}</span>}
      </span>
      <span class="coach__text" key={`${id}${ticked ? '-done' : ''}`}>
        <b>{copy.title}</b>
        <i>{ticked ? copy.done : copy.ask}</i>
      </span>
      <span class="coach__steps" aria-label={`Step ${view.step + 1} of ${INTRO_STEPS.length}`}>
        {INTRO_STEPS.map((s, i) => <i key={s.id} class={i < view.step || (i === view.step && view.done) ? 'is-done' : i === view.step ? 'is-on' : ''} />)}
      </span>
      <button type="button" class="coach__skip" tabIndex={-1} onClick={onSkip}>Skip</button>
    </div>
  );
}

/** Announces newly earned achievements wherever the player is. */
export function Toaster() {
  const app = useApp();
  const profile = useProfile();
  const known = useRef<Set<string> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [toasts, setToasts] = useState<{ id: string; name: string; text: string }[]>([]);
  if (known.current === null) known.current = new Set(Object.keys(profile.achievements));

  const count = Object.keys(profile.achievements).length;
  useEffect(() => {
    // A reset wipes achievements: forget them so they can be announced again.
    if (count === 0) { known.current = new Set(); return; }
    const fresh = Object.keys(profile.achievements).filter((id) => !known.current!.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) known.current!.add(id);
    // The results screen already lists what a clear earned.
    const gs = app.game.state;
    if (gs.mode === 'play' && (gs.phase === 'results' || gs.phase === 'won')) return;
    const items = fresh.map((id) => ({ id, name: achievementName(id), text: findAchievement(id)?.description ?? '' }));
    setToasts((t) => [...t, ...items].slice(-4));
    app.sound('unlock');
    timers.current.push(setTimeout(() => setToasts((t) => t.filter((x) => !fresh.includes(x.id))), 5200));
  }, [count]);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);

  if (toasts.length === 0) return null;
  return (
    <div class="toasts" role="status">
      {toasts.map((t) => (
        <div class="toast cut" key={t.id}>
          <span class="toast__mark"><IconStar size={14} /></span>
          <span><i>Achievement unlocked</i><b>{t.name}</b><em>{t.text}</em></span>
        </div>
      ))}
    </div>
  );
}
