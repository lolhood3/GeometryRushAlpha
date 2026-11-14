import { useEffect, useRef, useState } from 'preact/hooks';
import {
  defaultSettings, sectionIsDefault, sectionValues, type Quality, type Settings, type SettingsSection,
} from '../../game/progression/profile.ts';
import { Button, FieldText, ScreenFrame, Segmented, Slider, Toggle } from '../components/controls.tsx';
import { useApp, useArrowNav, useFrame, useGameState, useKey, useProfile } from '../context.ts';
import { Calibrator, OFFSET_MAX, OFFSET_MIN, formatMs } from './settings/calibrator.tsx';
import { SaveDataPane } from './settings/data.tsx';
import { KeyBindingsGroup } from './settings/keys.tsx';
import { Group, NoticeBar, Row, useNotice, type Notify } from './settings/parts.tsx';

type Section = SettingsSection | 'data';
const SECTIONS: { id: Section; label: string; note: string; blurb: string }[] = [
  { id: 'audio', label: 'Audio', note: 'Volume · sync', blurb: 'Set the mix, and line the music up with the picture.' },
  { id: 'video', label: 'Video', note: 'Quality · effects', blurb: 'Trade sharpness and effects for a steadier frame rate.' },
  { id: 'gameplay', label: 'Gameplay', note: 'Run · HUD · keys', blurb: 'How a run behaves, what the HUD shows, and which keys you play with.' },
  { id: 'access', label: 'Accessibility', note: 'Motion · contrast', blurb: 'Make the game calmer to look at and easier to read.' },
  { id: 'data', label: 'Save data', note: 'Backup · reset', blurb: 'Back up, move or erase the progress stored in this browser.' },
];
const pct = (v: number) => `${Math.round(v * 100)}%`;
const DEFAULTS = defaultSettings();

interface PaneProps {
  s: Settings;
  set: (patch: Partial<Settings>) => void;
  notify: Notify;
}

function AudioPane({ s, set, notify }: PaneProps) {
  const app = useApp();
  const { game } = app;
  const running = useGameState().audio;
  const [calibrating, setCalibrating] = useState(false);
  // What the device reports on its own, without the player's correction.
  const device = Math.round((game.audio.latency - s.audioOffsetMs / 1000) * 1000);
  const blip = () => app.sound('toggle', 1);
  return (
    <>
      {!running && (
        <p class="set-status is-warn"><i aria-hidden="true" />Sound is not running in this browser right now, so changes here cannot be heard yet.</p>
      )}
      <Group title="Mix" aside={s.muted ? <span class="set-flag">Muted</span> : undefined}>
        <Slider label="Master volume" hint="Everything the game plays." value={s.master} format={pct} mark={DEFAULTS.master} nudge={0.05} dim={s.muted}
          onChange={(v) => set({ master: v })} onCommit={blip} />
        <Slider label="Music" value={s.music} format={pct} mark={DEFAULTS.music} nudge={0.05} dim={s.muted}
          onChange={(v) => set({ music: v })} />
        <Slider label="Effects" hint="Jumps, pickups, crashes and menu sounds." value={s.sfx} format={pct} mark={DEFAULTS.sfx} nudge={0.05} dim={s.muted}
          onChange={(v) => set({ sfx: v })} onCommit={blip} />
        <Toggle label="Mute all" hint="Silences the game and keeps the levels above." value={s.muted} onChange={(v) => set({ muted: v })} />
      </Group>

      <Group title="Sync">
        <Slider label="Sync offset" hint="Raise it if the music sounds late compared with what you see, as it can over Bluetooth."
          value={s.audioOffsetMs} min={OFFSET_MIN} max={OFFSET_MAX} step={5} nudge={5} origin={0} mark={0} format={formatMs}
          onChange={(v) => set({ audioOffsetMs: v })} />
        <Row>
          <FieldText label="Measure sync"
            hint={running
              ? 'Tap along to a click track and the game works out the offset for you.'
              : 'Needs sound to be running, so there is nothing to measure yet.'} />
          <Button variant="ghost" size="sm" disabled={!running} onClick={() => setCalibrating(true)}>Calibrate</Button>
        </Row>
        {running && (
          <dl class="readout">
            <div><dt>Device latency</dt><dd class="mono">{device} ms</dd></div>
            <div><dt>Your offset</dt><dd class="mono">{formatMs(s.audioOffsetMs)}</dd></div>
            <div><dt>Compensated</dt><dd class="mono">{device + s.audioOffsetMs} ms</dd></div>
          </dl>
        )}
      </Group>
      {calibrating && (
        <Calibrator onClose={() => setCalibrating(false)} onApplied={(v) => notify({ tone: 'ok', text: `Sync offset set to ${formatMs(v)}.` })} />
      )}
    </>
  );
}

const QUALITY_NOTES: Record<Quality, string> = {
  auto: 'Starts at full sharpness and lowers the render resolution whenever frames run long. The safe choice on any device.',
  low: 'Renders at 1× resolution with a simpler backdrop and fewer particles. Fastest.',
  medium: 'Renders at up to 1.5× resolution with most particles.',
  high: 'Renders at up to 2× resolution with every particle. Sharpest, and the heaviest on the device.',
};

/** What the renderer is doing at this moment, so the effect of a preset can be seen. */
function RenderReadout() {
  const { game } = useApp();
  const res = useRef<HTMLElement>(null);
  const fps = useRef<HTMLElement>(null);
  const n = useRef(0);
  const shown = useRef('');
  const write = () => {
    shown.current = game.live.resolution;
    if (res.current) res.current.textContent = shown.current || '—';
    if (fps.current) fps.current.textContent = `${Math.round(game.live.fps)} FPS`;
  };
  useEffect(write, []);
  // A new resolution shows at once; the frame rate is only refreshed now and then so it can be read.
  useFrame(() => { if (game.live.resolution !== shown.current || n.current++ % 20 === 0) write(); });
  return (
    <dl class="readout">
      <div><dt>Rendering at</dt><dd class="mono" ref={res}>—</dd></div>
      <div><dt>Frame rate</dt><dd class="mono" ref={fps}>—</dd></div>
    </dl>
  );
}

function useFullscreen(): { supported: boolean; on: boolean; toggle: () => Promise<boolean> } {
  const [on, setOn] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      return true;
    } catch {
      return false;
    }
  };
  return { supported: !!document.fullscreenEnabled, on, toggle };
}

const HELD_BY_MOTION = 'Held off by Reduced motion, in Accessibility.';

function VideoPane({ s, set, notify }: PaneProps) {
  const fs = useFullscreen();
  return (
    <>
      <Group title="Quality">
        <Segmented<Quality> label="Preset" hint={QUALITY_NOTES[s.quality]} value={s.quality} onChange={(v) => set({ quality: v })}
          options={[
            { id: 'auto', label: 'Auto', note: 'Adapts' },
            { id: 'low', label: 'Low', note: '1×' },
            { id: 'medium', label: 'Medium', note: '1.5×' },
            { id: 'high', label: 'High', note: '2×' },
          ]} />
        <RenderReadout />
      </Group>

      <Group title="Effects">
        <Toggle label="Particles" hint="Dust, sparks, bursts and ambient motes. Off keeps only a sparse trace of them." value={s.particles} onChange={(v) => set({ particles: v })} />
        <Toggle label="Screen shake" hint="The camera jolt on a crash." value={s.shake && !s.reducedMotion} locked={s.reducedMotion}
          note={s.reducedMotion ? HELD_BY_MOTION : undefined} onChange={(v) => set({ shake: v })} />
        <Toggle label="Flashes" hint="Full-screen flashes on drops, crashes and clears." value={s.flashes && !s.reducedMotion} locked={s.reducedMotion}
          note={s.reducedMotion ? HELD_BY_MOTION : undefined} onChange={(v) => set({ flashes: v })} />
      </Group>

      <Group title="Display">
        <Toggle label="Performance readout" hint="Shows frame rate, render resolution and draw counts in the corner while playing." value={s.showFps} onChange={(v) => set({ showFps: v })} />
        {fs.supported && (
          <Toggle label="Fullscreen" hint="Fills the screen. Esc leaves it again." value={fs.on}
            onChange={() => { void fs.toggle().then((ok) => { if (!ok) notify({ tone: 'error', text: 'The browser did not allow fullscreen.' }); }); }} />
        )}
      </Group>
    </>
  );
}

function GameplayPane({ s, set, notify }: PaneProps) {
  const canVibrate = typeof navigator.vibrate === 'function';
  return (
    <>
      <Group title="Run">
        <Toggle label="Auto retry" hint="Starts the next attempt by itself after a crash. Off waits for a tap or a jump key. Practice always retries." value={s.autoRetry} onChange={(v) => set({ autoRetry: v })} />
      </Group>
      <Group title="HUD">
        <Toggle label="Progress bar" hint="The bar along the top edge and the percentage beside it." value={s.showProgress} onChange={(v) => set({ showProgress: v })} />
        <Toggle label="Sync streak" hint="The counter that builds while your inputs land on the beat." value={s.showSync} onChange={(v) => set({ showSync: v })} />
      </Group>
      <Group title="Feedback">
        <Toggle label="Vibration" hint="A short buzz on a crash and on a clear." value={s.haptics && canVibrate} locked={!canVibrate}
          note={canVibrate ? undefined : 'This browser has no vibration support.'}
          onChange={(v) => { set({ haptics: v }); if (v) navigator.vibrate(30); }} />
      </Group>
      <KeyBindingsGroup notify={notify} />
    </>
  );
}

function AccessPane({ s, set }: PaneProps) {
  const systemMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <>
      <Group title="Motion">
        <Toggle label="Reduced motion" hint="Removes screen shake, flashes and the squash on jumps, calms the beat pulse, and stops menu animation."
          note={systemMotion && !s.reducedMotion ? 'Your device asks for reduced motion. Turn this on to calm the game itself as well.' : undefined}
          value={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
        <Toggle label="Screen shake" hint="Also listed under Video." value={s.shake && !s.reducedMotion} locked={s.reducedMotion}
          note={s.reducedMotion ? 'Off while Reduced motion is on.' : undefined} onChange={(v) => set({ shake: v })} />
        <Toggle label="Flashes" hint="Full-screen flashes. Also listed under Video." value={s.flashes && !s.reducedMotion} locked={s.reducedMotion}
          note={s.reducedMotion ? 'Off while Reduced motion is on.' : undefined} onChange={(v) => set({ flashes: v })} />
      </Group>
      <Group title="Legibility">
        <Toggle label="High contrast" hint="Brighter secondary text and stronger outlines in every menu, and a solid backing behind text during play."
          value={s.highContrast} onChange={(v) => set({ highContrast: v })} />
      </Group>
    </>
  );
}

/** The section last opened, kept for the session so returning to Settings does not start over. */
let lastSection: Section = 'audio';

export function SettingsPanel({ sections = SECTIONS.map((x) => x.id), compact = false }: { sections?: Section[]; compact?: boolean }) {
  const app = useApp();
  const { store } = app;
  const s = useProfile().settings;
  const list = SECTIONS.filter((x) => sections.includes(x.id));
  const [section, setSection] = useState<Section>(sections.includes(lastSection) ? lastSection : sections[0]);
  const [dir, setDir] = useState<'down' | 'up'>('down');
  const { notice, notify, dismiss } = useNotice();
  const pane = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Settings>) => store.updateSettings(patch);
  const info = list.find((x) => x.id === section) ?? list[0];

  const open = (id: Section) => {
    if (id === section) return;
    app.sound('toggle', 1);
    setDir(list.findIndex((x) => x.id === id) > list.findIndex((x) => x.id === section) ? 'down' : 'up');
    setSection(id);
    lastSection = id;
    dismiss();
  };
  useEffect(() => {
    pane.current?.scrollTo(0, 0);
    // When the rail lies flat and scrolls sideways, keep the open category in view.
    document.getElementById(`set-tab-${section}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [section]);

  const restoreDefaults = (id: SettingsSection) => {
    const before = sectionValues(store.profile.settings, id);
    set(sectionValues(defaultSettings(), id));
    notify({
      tone: 'ok', text: `${info.label} settings restored to defaults.`,
      action: { label: 'Undo', run: () => { set(before); notify({ tone: 'ok', text: `${info.label} settings put back.` }); } },
    });
  };

  const props: PaneProps = { s, set, notify };
  return (
    <div class={`settings ${compact ? 'settings--compact' : ''}`}>
      <nav class="set-nav" role="tablist" aria-label="Settings categories" aria-orientation={compact ? 'horizontal' : 'vertical'}>
        {list.map((x, i) => (
          <button type="button" key={x.id} role="tab" id={`set-tab-${x.id}`} aria-selected={x.id === section} aria-controls="set-pane"
            class={`set-nav__item ${x.id === section ? 'is-on' : ''}`} onClick={() => open(x.id)}>
            <span class="set-nav__n mono">{String(i + 1).padStart(2, '0')}</span>
            <span class="set-nav__label">{x.label}</span>
            <span class="set-nav__note">{x.note}</span>
          </button>
        ))}
        <p class={`set-nav__foot ${store.readOnly ? 'is-warn' : ''}`}>
          <i aria-hidden="true" />{store.readOnly ? 'Storage blocked · changes last until the page closes' : 'Changes save automatically'}
        </p>
      </nav>

      <div class="set-main">
        <div class="set-pane" id="set-pane" role="tabpanel" aria-labelledby={`set-tab-${section}`} ref={pane}>
          <div class="set-pane__inner" key={section} data-dir={dir}>
            <header class="set-pane__head">
              <div>
                <h2 class="set-pane__title">{info.label}</h2>
                <p class="set-pane__blurb">{info.blurb}</p>
              </div>
              {section !== 'data' && (
                <button type="button" class="set-link" disabled={sectionIsDefault(s, section)}
                  onClick={() => { app.sound('click'); restoreDefaults(section); }}>Restore defaults</button>
              )}
            </header>
            {section === 'audio' && <AudioPane {...props} />}
            {section === 'video' && <VideoPane {...props} />}
            {section === 'gameplay' && <GameplayPane {...props} />}
            {section === 'access' && <AccessPane {...props} />}
            {section === 'data' && <SaveDataPane notify={notify} clearNotice={dismiss} />}
          </div>
        </div>
        <NoticeBar notice={notice} onDismiss={dismiss} />
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const app = useApp();
  const nav = useArrowNav();
  useKey((e) => { if (e.key === 'Escape' && !document.querySelector('.dialog-scrim')) { app.sound('back'); app.go('menu'); } });
  return (
    <div class="screen settings-screen" ref={nav}>
      <ScreenFrame title="Settings" index="06" onBack={() => app.go('menu')}>
        <SettingsPanel />
      </ScreenFrame>
    </div>
  );
}
