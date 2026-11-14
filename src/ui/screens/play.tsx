import { useEffect, useRef, useState } from 'preact/hooks';
import { getLevel, LEVEL_IDS } from '../../game/levels/index.ts';
import { achievementName, findAchievement } from '../../game/progression/achievements.ts';
import { cosmeticName } from '../../game/progression/cosmetics.ts';
import { keyLabel } from '../../game/progression/keys.ts';
import { isLevelUnlocked, syncPercent } from '../../game/progression/profile.ts';
import type { RunResult } from '../../game/game.ts';
import { Button } from '../components/controls.tsx';
import { IconFlag, IconPause, IconPlay, IconRetry, IconShard, IconStar, IconUndo } from '../components/icons.tsx';
import { useApp, useArrowNav, useFrame, useGameState, useKey, useProfile } from '../context.ts';
import { SettingsPanel } from './settings.tsx';

function PauseMenu() {
  const app = useApp();
  const st = useGameState();
  const nav = useArrowNav();
  const [settings, setSettings] = useState(false);
  const meta = getLevel(st.levelId).meta;
  return (
    <div class="overlay pause" ref={nav}>
      <div class={`pause__panel cut ${settings ? 'pause__panel--settings' : ''}`}>
        <span class="eyebrow">Paused · {st.practice ? 'Practice' : 'Normal'}</span>
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
            <Button onClick={() => app.game.restart(!st.practice)}>
              <IconFlag size={15} /> {st.practice ? 'Switch to Normal' : 'Switch to Practice'}
            </Button>
            <Button onClick={() => setSettings(true)}>Settings</Button>
            <Button variant="quiet" sound="back" onClick={() => app.leave('levels')}>Exit to levels</Button>
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
  const nextId = LEVEL_IDS[meta.index + 1];
  const next = nextId && isLevelUnlocked(profile, nextId) ? getLevel(nextId).meta : null;
  const rec = profile.levels[result.levelId];

  const rewards: { k: string; v: string }[] = [];
  if (!result.practice && o.firstCompletion) rewards.push({ k: 'Stars', v: `+${meta.stars}` });
  if (o.newShards > 0) rewards.push({ k: 'Shards banked', v: `+${o.newShards}` });
  if (o.unlockedLevel) rewards.push({ k: 'Track unlocked', v: getLevel(o.unlockedLevel).meta.name });
  for (const c of o.cosmetics) rewards.push({ k: 'Unlocked', v: cosmeticName(c) });
  for (const a of o.achievements) rewards.push({ k: 'Achievement', v: achievementName(a) });

  return (
    <div class="overlay results" ref={nav}>
      <div class="results__panel cut">
        <span class="eyebrow">{result.practice ? 'Practice clear' : o.firstCompletion ? 'First clear' : 'Track cleared'}</span>
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

        {result.practice ? (
          <p class="results__note">Practice clears open the next track, but stars, shards and records are only earned in Normal mode.</p>
        ) : rec.shards !== 7 ? (
          <p class="results__note">{3 - ((rec.shards & 1) + ((rec.shards >> 1) & 1) + ((rec.shards >> 2) & 1))} shard(s) still hidden on this track.</p>
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

        <div class="results__actions">
          {result.practice
            ? <Button variant="primary" size="lg" autoFocus sound="start" onClick={() => app.game.restart(false)}><IconPlay size={16} /> Play for real</Button>
            : next
              ? <Button variant="primary" size="lg" autoFocus sound="start" onClick={() => app.play(next.id, false)}><IconPlay size={16} /> Next · {next.name}</Button>
              : <Button variant="primary" size="lg" autoFocus onClick={() => app.leave('records')}>View records</Button>}
          <Button onClick={() => app.game.restart()}><IconRetry size={16} /> Replay</Button>
          {o.cosmetics.length > 0 && <Button onClick={() => app.leave('garage')}>Garage</Button>}
          <Button variant="quiet" sound="back" onClick={() => app.leave('levels')}>Levels</Button>
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
  const bar = useRef<HTMLSpanElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const streak = useRef<HTMLDivElement>(null);
  const streakN = useRef<HTMLSpanElement>(null);
  const perf = useRef<HTMLDivElement>(null);
  const last = useRef({ pct: -1, streak: -1, frame: 0 });

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
    if (perf.current && (l.frame++ & 15) === 0) {
      perf.current.textContent = `${Math.round(lv.fps)} FPS · ${lv.resolution} · ${lv.instances} quads · ${lv.particles} particles`;
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
      else if (st.phase === 'results') app.leave('levels');
      else game.pause();
      e.preventDefault();
    } else if (bound(keys.restart) && st.phase !== 'paused' && st.phase !== 'won') {
      game.restart();
    } else if (bound(keys.checkpoint) && st.practice) {
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
  // On-screen prompts name the key the player actually has bound to jump.
  const jumpKey = keys.jump.length ? keyLabel(keys.jump[0]) : '';
  const cueSub = (text: string) => (keys.jump.includes('Space') ? text : text.replace(/Space( · )?/, jumpKey ? `${jumpKey}$1` : ''));
  return (
    <div class={`screen play ${settings.highContrast ? 'is-contrast' : ''}`} style={{ '--accent': meta.themes[0].accent } as never}>
      <div class={`hud ${st.phase === 'results' || st.phase === 'won' ? 'is-hidden' : ''}`}>
        {settings.showProgress && <div class="hud__progress"><span ref={bar} /></div>}
        <div class="hud__top">
          <button type="button" class="icon-btn hud__pause" tabIndex={-1} aria-label="Pause"
            onClick={() => (st.phase === 'paused' ? game.resume() : game.pause())}>
            <IconPause size={18} />
          </button>
          <div class="hud__title">
            <b>{meta.name}</b>
            <i>{st.practice && <em class="tag">Practice</em>}Attempt {st.attempt}</i>
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

        {st.cue && cueShown === st.cue.id && playing && (
          <div class="cue" key={st.cue.id}>
            <b>{st.cue.text}</b>
            {st.cue.sub && <i>{cueSub(st.cue.sub)}</i>}
          </div>
        )}

        {st.phase === 'countdown' && st.countdown > 0 && <div class="countdown mono" key={st.countdown}>{st.countdown}</div>}

        {st.phase === 'dead' && (
          <div class="death" key={st.attempt}>
            <b class="mono">{st.deathPct}%</b>
            {st.newBest && <i>New best</i>}
            {st.awaitRetry && <span class="death__retry">{jumpKey ? `Tap or press ${jumpKey} to retry` : 'Tap to retry'}</span>}
          </div>
        )}

        {st.practice && (
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
