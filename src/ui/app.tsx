import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SfxName } from '../engine/audio/sfx.ts';
import { Game } from '../game/game.ts';
import { getLevel, LEVEL_IDS } from '../game/levels/index.ts';
import { getSong } from '../game/music/songs.ts';
import { isLevelUnlocked } from '../game/progression/profile.ts';
import { ProfileStore, type KeyValueStore } from '../game/progression/store.ts';
import { gate } from './components/rotate.tsx';
import { AppContext, type AppApi, type ScreenId, useProfile } from './context.ts';
import { Credits } from './screens/credits.tsx';
import { Garage } from './screens/garage.tsx';
import { LevelSelect } from './screens/levels.tsx';
import { MainMenu } from './screens/menu.tsx';
import { PlayScreen, Toaster } from './screens/play.tsx';
import { Records } from './screens/records.tsx';
import { SettingsScreen } from './screens/settings.tsx';
import { Updates } from './screens/updates.tsx';

type Stage = 'boot' | 'title' | 'app' | 'fatal';
type Curtain = 'open' | 'closing' | 'closed' | 'opening';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function safeStorage(): KeyValueStore | null {
  try {
    const s = window.localStorage;
    s.getItem('geometry_rush_v2_probe');
    return s;
  } catch {
    return null;
  }
}

const SCREENS: Record<ScreenId, () => preact.JSX.Element> = {
  menu: MainMenu, levels: LevelSelect, garage: Garage, records: Records, updates: Updates, settings: SettingsScreen, credits: Credits, play: PlayScreen,
};

/** Applies settings that live in CSS and keeps the accent colour in step with the focused level. */
function Chrome({ accent }: { accent: string }) {
  const s = useProfile().settings;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduced-motion', s.reducedMotion);
    root.style.setProperty('--accent', accent);
  }, [s.reducedMotion, accent]);
  return null;
}

export function App({ canvas }: { canvas: HTMLCanvasElement }) {
  const [stage, setStage] = useState<Stage>('boot');
  const [boot, setBoot] = useState({ step: 'Starting', progress: 0 });
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<ScreenId>('menu');
  const [leaving, setLeaving] = useState<ScreenId | null>(null);
  const [curtain, setCurtain] = useState<Curtain>('open');
  const [focusLevel, setFocusLevelState] = useState<string>(LEVEL_IDS[0]);
  const gameRef = useRef<Game | null>(null);
  const storeRef = useRef<ProfileStore | null>(null);
  const busy = useRef(false);

  // ── Boot: real work, reported as it happens ───────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const started = performance.now();
      try {
        setBoot({ step: 'Loading typefaces', progress: 0.05 });
        await Promise.race([
          Promise.all(['900 1em "Unbounded Variable"', '500 1em "Geist Variable"', '500 1em "Geist Mono Variable"'].map((f) => document.fonts.load(f))),
          wait(2500),
        ]);
        setBoot({ step: 'Reading save data', progress: 0.2 });
        const store = new ProfileStore(safeStorage());
        storeRef.current = store;
        await nextFrame();

        setBoot({ step: 'Compiling shaders', progress: 0.3 });
        await nextFrame();
        const game = new Game(canvas, store);
        gameRef.current = game;
        if (import.meta.env.DEV) (window as unknown as { __gr: Game }).__gr = game;

        for (let i = 0; i < LEVEL_IDS.length; i++) {
          const meta = getLevel(LEVEL_IDS[i]).meta;
          setBoot({ step: `Building track ${String(i + 1).padStart(2, '0')} · ${meta.name}`, progress: 0.4 + (i / LEVEL_IDS.length) * 0.4 });
          getSong(meta.song);
          await nextFrame();
        }
        setBoot({ step: 'Warming up', progress: 0.9 });
        // A phone held upright freezes the game until it is turned (see engine/orientation.ts).
        game.setSuspended(gate.blocked);
        gate.subscribe((blocked) => game.setSuspended(blocked));
        game.start();
        window.addEventListener('pagehide', () => store.flush());
        document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });
        await wait(Math.max(0, 700 - (performance.now() - started)));
        if (cancelled) return;
        setBoot({ step: 'Ready', progress: 1 });
        const last = store.profile.lastLevel;
        setFocusLevelState(isLevelUnlocked(store.profile, last) ? last : LEVEL_IDS[0]);
        await wait(220);
        setStage('title');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStage('fatal');
      }
    })();
    return () => { cancelled = true; };
  }, [canvas]);

  // ── Title: the first gesture also unlocks audio ───────────────────────────
  useEffect(() => {
    if (stage !== 'title') return;
    const begin = () => {
      const game = gameRef.current!;
      void game.unlockAudio().then(() => game.sfx.play('start')).catch(() => {});
      setStage('app');
    };
    const onKey = (e: KeyboardEvent) => { if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key !== 'Tab') begin(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', begin);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('click', begin); };
  }, [stage]);

  // Browsers may suspend audio on their own (interruptions, autoplay policy): any gesture brings it back.
  useEffect(() => {
    if (stage !== 'app') return;
    const wake = () => {
      const game = gameRef.current!;
      if (!game.audio.running && !document.hidden) void game.unlockAudio().catch(() => {});
    };
    // Touch only counts as a gesture on release, so listen for every event a
    // browser accepts, and before the UI handles it (capture).
    const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    for (const e of events) window.addEventListener(e, wake, true);
    return () => { for (const e of events) window.removeEventListener(e, wake, true); };
  }, [stage]);

  const go = useCallback((to: ScreenId) => {
    setScreen((from) => {
      if (from === to) return from;
      setLeaving(from);
      setTimeout(() => setLeaving((l) => (l === from ? null : l)), 200);
      return to;
    });
  }, []);

  const throughCurtain = useCallback(async (action: () => void) => {
    if (busy.current) return;
    busy.current = true;
    setCurtain('closing');
    await wait(340);
    setCurtain('closed');
    action();
    await nextFrame();
    await wait(90);
    setCurtain('opening');
    await wait(380);
    setCurtain('open');
    busy.current = false;
  }, []);

  const api = useMemo<AppApi | null>(() => {
    const game = gameRef.current;
    const store = storeRef.current;
    if (!game || !store) return null;
    return {
      game, store, screen, go, focusLevel,
      setFocusLevel: setFocusLevelState,
      sound: (name: SfxName, arg?: number) => game.sfx.play(name, arg),
      play: (levelId, practice) => {
        void throughCurtain(() => {
          setFocusLevelState(levelId);
          game.startLevel(levelId, practice);
          setLeaving(null);
          setScreen('play');
        });
      },
      leave: (to) => {
        void throughCurtain(() => {
          game.exitLevel();
          setLeaving(null);
          setScreen(to);
        });
      },
    };
  }, [stage, screen, focusLevel, go, throughCurtain]);

  if (stage === 'fatal') {
    return (
      <div class="fatal">
        <div class="fatal__panel cut">
          <span class="eyebrow">Cannot start</span>
          <h1>Geometry Rush needs WebGL 2</h1>
          <p>This browser or device could not create the graphics context the game renders with. Try a current version of Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is enabled.</p>
          <code>{error}</code>
        </div>
      </div>
    );
  }

  if (stage === 'boot' || !api) {
    return (
      <div class="boot">
        <div class="boot__inner">
          <div class="boot__mark"><span /></div>
          <div class="boot__name">GEOMETRY RUSH <em>V.2</em></div>
          <div class="boot__bar"><span style={{ transform: `scaleX(${boot.progress})` }} /></div>
          <div class="boot__row"><span>{boot.step}</span><span class="mono">{Math.round(boot.progress * 100)}%</span></div>
        </div>
      </div>
    );
  }

  const accent = getLevel(focusLevel).meta.themes[0].accent;
  const Current = SCREENS[screen];
  const Leaving = leaving ? SCREENS[leaving] : null;

  return (
    <AppContext.Provider value={api}>
      <Chrome accent={accent} />
      {stage === 'title' ? (
        <div class="title">
          <div class="title__inner">
            <h1 class="logo logo--title" aria-label="Geometry Rush V.2">
              <span class="logo__line">GEOMETRY</span>
              <span class="logo__line logo__line--rush">RUSH<em>V.2</em></span>
            </h1>
            <p class="title__prompt"><span class="is-key">Press any key</span><i class="is-key">or click to start</i><span class="is-touch">Tap to start</span></p>
          </div>
          <p class="title__foot">Created by Ankan Barik · Rush Engine 2 · Best with sound on</p>
        </div>
      ) : (
        <>
          <div class={`scrim scrim--${screen}`} />
          {Leaving && leaving !== screen && <div class="layer is-leaving" key={`out-${leaving}`} aria-hidden="true"><Leaving /></div>}
          <div class="layer is-entering" key={screen}><Current /></div>
          <Toaster />
        </>
      )}
      <div class={`curtain curtain--${curtain}`} aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ '--i': i } as never} />)}</div>
    </AppContext.Provider>
  );
}
