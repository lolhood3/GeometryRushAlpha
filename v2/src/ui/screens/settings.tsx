import { useEffect, useRef, useState } from 'preact/hooks';
import { getSong } from '../../game/music/songs.ts';
import type { Quality, Settings } from '../../game/progression/profile.ts';
import { Button, Dialog, ScreenFrame, Segmented, Slider, Toggle } from '../components/controls.tsx';
import { useApp, useArrowNav, useKey, useProfile } from '../context.ts';

type Section = 'audio' | 'video' | 'gameplay' | 'access' | 'data';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'access', label: 'Accessibility' },
  { id: 'data', label: 'Save data' },
];
const pct = (v: number) => `${Math.round(v * 100)}%`;
const ms = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)} ms`;

/** Tap-along latency measurement: the player taps to a click track and the average error becomes the offset. */
function Calibrator({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const { game, store } = app;
  const [taps, setTaps] = useState<number[]>([]);
  const previous = useRef(store.profile.settings.audioOffsetMs);
  const NEEDED = 12;
  const song = getSong('metronome');
  const beat = 60 / song.bpm;

  useEffect(() => {
    game.audio.offsetMs = 0;
    game.music.play(song, { loop: true, delay: 0.3 });
    return () => {
      game.audio.offsetMs = store.profile.settings.audioOffsetMs;
      game.music.stop(0.1);
      game.playMenuMusic();
    };
  }, []);

  const tap = () => {
    const t = game.music.songTime();
    if (Number.isNaN(t) || t < 0) return;
    const phase = t / beat;
    const err = (phase - Math.round(phase)) * beat * 1000;
    setTaps((list) => (list.length >= NEEDED ? list : [...list, err]));
  };
  useKey((e) => {
    if (e.code === 'Space' && !e.repeat) { e.preventDefault(); tap(); }
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
  });

  // Ignore the first taps while the player finds the pulse; use the median of the rest.
  const used = taps.slice(2).sort((a, b) => a - b);
  const median = used.length ? used[Math.floor(used.length / 2)] : 0;
  const spread = used.length > 2 ? used[used.length - 1] - used[0] : 0;
  const result = Math.max(-150, Math.min(250, Math.round(median)));
  const done = taps.length >= NEEDED;

  return (
    <Dialog title="Sync calibration" actions={
      <>
        <Button variant="quiet" sound="back" onClick={onClose}>Cancel</Button>
        <Button variant="ghost" onClick={() => setTaps([])} disabled={taps.length === 0}>Start over</Button>
        <Button variant="primary" disabled={!done} onClick={() => { store.updateSettings({ audioOffsetMs: result }); onClose(); }}>
          Apply {ms(result)}
        </Button>
      </>
    }>
      <p>Tap the pad (or press <kbd>Space</kbd>) exactly on each click you hear. {NEEDED} taps are needed.</p>
      <button type="button" class={`tap-pad cut ${done ? 'is-done' : ''}`} onPointerDown={(e) => { e.preventDefault(); tap(); }}>
        <span class="tap-pad__count mono">{Math.min(taps.length, NEEDED)}<small>/{NEEDED}</small></span>
        <span class="tap-pad__dots">{Array.from({ length: NEEDED }, (_, i) => <i key={i} class={i < taps.length ? 'is-on' : ''} />)}</span>
        <span class="tap-pad__hint">{done ? 'Measured' : 'Tap here'}</span>
      </button>
      <div class="calib">
        <div><span>Measured offset</span><b class="mono">{used.length ? ms(result) : '—'}</b></div>
        <div><span>Consistency</span><b class="mono">{used.length > 2 ? (spread < 60 ? 'Steady' : spread < 120 ? 'Fair' : 'Loose · try again') : '—'}</b></div>
        <div><span>Current setting</span><b class="mono">{ms(previous.current)}</b></div>
      </div>
    </Dialog>
  );
}

export function SettingsPanel({ sections = SECTIONS.map((s) => s.id) }: { sections?: Section[] }) {
  const app = useApp();
  const { store, game } = app;
  const s = useProfile().settings;
  const [section, setSection] = useState<Section>(sections[0]);
  const [calibrating, setCalibrating] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Settings>) => store.updateSettings(patch);
  const audioOn = game.audio.running;

  const exportSave = () => {
    const blob = new Blob([store.exportSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geometry-rush-v2-save.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote('Save file exported.');
  };
  const importSave = async (f: File | undefined) => {
    if (!f) return;
    try {
      store.importSave(await f.text());
      app.sound('unlock');
      setNote('Save file imported.');
    } catch {
      app.sound('deny');
      setNote('That file is not a valid Geometry Rush V.2 save.');
    }
    if (file.current) file.current.value = '';
  };

  return (
    <div class="settings">
      <div class="tabs tabs--rail" role="tablist">
        {SECTIONS.filter((x) => sections.includes(x.id)).map((x) => (
          <button type="button" key={x.id} role="tab" aria-selected={x.id === section} class={x.id === section ? 'is-on' : ''}
            onClick={() => { app.sound('toggle', 1); setSection(x.id); }}>{x.label}</button>
        ))}
      </div>

      <div class="settings__pane" key={section}>
        {section === 'audio' && <>
          <Slider label="Master volume" value={s.master} format={pct} onChange={(v) => set({ master: v })} />
          <Slider label="Music" value={s.music} format={pct} onChange={(v) => set({ music: v })} />
          <Slider label="Effects" value={s.sfx} format={pct} onChange={(v) => set({ sfx: v })} />
          <Toggle label="Mute all" value={s.muted} onChange={(v) => set({ muted: v })} />
          <Slider label="Sync offset" hint="Raise it if the music sounds late compared to what you see (Bluetooth audio)."
            value={s.audioOffsetMs} min={-150} max={250} step={5} format={ms} onChange={(v) => set({ audioOffsetMs: v })} />
          <div class="field">
            <span class="field__text">
              <span class="field__label">Measure sync</span>
              <span class="field__hint">
                {audioOn
                  ? `Output latency reported by this device: ${Math.round((game.audio.latency - s.audioOffsetMs / 1000) * 1000)} ms. Already compensated.`
                  : 'Audio is not running on this device, so there is nothing to calibrate.'}
              </span>
            </span>
            <Button variant="ghost" size="sm" disabled={!audioOn} onClick={() => setCalibrating(true)}>Calibrate</Button>
          </div>
        </>}

        {section === 'video' && <>
          <Segmented<Quality> label="Quality" hint="Auto lowers the render resolution when frames run long."
            value={s.quality} onChange={(v) => set({ quality: v })}
            options={[{ id: 'auto', label: 'Auto' }, { id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }]} />
          <Toggle label="Particles" hint="Dust, sparks, bursts and ambient motes." value={s.particles} onChange={(v) => set({ particles: v })} />
          <Toggle label="Screen shake" value={s.shake} onChange={(v) => set({ shake: v })} />
          <Toggle label="Flashes" hint="Full-screen flashes on drops, crashes and clears." value={s.flashes} onChange={(v) => set({ flashes: v })} />
          <Toggle label="Performance readout" hint="Frame rate, resolution and draw counts while playing." value={s.showFps} onChange={(v) => set({ showFps: v })} />
          {document.fullscreenEnabled && (
            <div class="field">
              <span class="field__text"><span class="field__label">Fullscreen</span></span>
              <Button variant="ghost" size="sm" onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else void document.documentElement.requestFullscreen().catch(() => setNote('Fullscreen was blocked by the browser.'));
              }}>Toggle</Button>
            </div>
          )}
        </>}

        {section === 'gameplay' && <>
          <Toggle label="Auto retry" hint="Restart automatically after a crash." value={s.autoRetry} onChange={(v) => set({ autoRetry: v })} />
          <Toggle label="Progress bar" value={s.showProgress} onChange={(v) => set({ showProgress: v })} />
          <Toggle label="Sync streak" hint="Show the on-beat streak counter." value={s.showSync} onChange={(v) => set({ showSync: v })} />
          <Toggle label="Vibration" hint="On devices that support it." value={s.haptics} onChange={(v) => set({ haptics: v })} />
          <div class="keys">
            <div><kbd>Space</kbd><kbd>↑</kbd><kbd>W</kbd><span>Jump · hold to fly</span></div>
            <div><kbd>Click</kbd><kbd>Touch</kbd><kbd>Ⓐ</kbd><span>Same, anywhere on screen</span></div>
            <div><kbd>Esc</kbd><kbd>P</kbd><span>Pause</span></div>
            <div><kbd>R</kbd><span>Restart</span></div>
            <div><kbd>Z</kbd><span>Remove last checkpoint (Practice)</span></div>
          </div>
        </>}

        {section === 'access' && <>
          <Toggle label="Reduced motion" hint="Calms beat pulsing, removes shake, flashes and menu motion." value={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
          <Toggle label="High-contrast HUD" hint="Solid backing behind in-game text." value={s.highContrast} onChange={(v) => set({ highContrast: v })} />
        </>}

        {section === 'data' && <>
          <div class="field">
            <span class="field__text">
              <span class="field__label">Export save</span>
              <span class="field__hint">Download your progress as a file to back it up or move it to another device.</span>
            </span>
            <Button variant="ghost" size="sm" onClick={exportSave}>Export</Button>
          </div>
          <div class="field">
            <span class="field__text">
              <span class="field__label">Import save</span>
              <span class="field__hint">Replaces the progress on this device.</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => file.current?.click()}>Import</Button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void importSave((e.target as HTMLInputElement).files?.[0])} />
          </div>
          <div class="field">
            <span class="field__text">
              <span class="field__label">Reset progress</span>
              <span class="field__hint">Erases records, shards, achievements and unlocks. Settings are kept.</span>
            </span>
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>Reset</Button>
          </div>
          {store.readOnly && <p class="warn">This browser is blocking storage, so progress cannot be saved between visits.</p>}
        </>}
        {note && <p class="note" role="status">{note}</p>}
      </div>

      {calibrating && <Calibrator onClose={() => setCalibrating(false)} />}
      {confirmReset && (
        <Dialog title="Reset all progress?" actions={
          <>
            <Button variant="quiet" sound="back" autoFocus onClick={() => setConfirmReset(false)}>Keep my progress</Button>
            <Button variant="danger" onClick={() => { store.resetProgress(); setConfirmReset(false); setNote('Progress reset.'); }}>Erase everything</Button>
          </>
        }>
          <p>Every record, shard, achievement and unlocked cosmetic on this device will be erased. This cannot be undone.</p>
        </Dialog>
      )}
    </div>
  );
}

export function SettingsScreen() {
  const app = useApp();
  const nav = useArrowNav();
  useKey((e) => { if (e.key === 'Escape' && !document.querySelector('.dialog-scrim')) { app.sound('back'); app.go('menu'); } });
  return (
    <div class="screen settings-screen" ref={nav}>
      <ScreenFrame title="Settings" index="05" onBack={() => app.go('menu')}>
        <SettingsPanel />
      </ScreenFrame>
    </div>
  );
}
