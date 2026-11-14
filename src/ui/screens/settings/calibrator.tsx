import { useEffect, useRef, useState } from 'preact/hooks';
import { getSong } from '../../../game/music/songs.ts';
import { Button, Dialog } from '../../components/controls.tsx';
import { useApp, useKey } from '../../context.ts';

export const formatMs = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)} ms`;
export const OFFSET_MIN = -150;
export const OFFSET_MAX = 250;

/** Tap-along latency measurement: the player taps to a click track and the median error becomes the offset. */
export function Calibrator({ onClose, onApplied }: { onClose: () => void; onApplied: (ms: number) => void }) {
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
  });

  // Ignore the first taps while the player finds the pulse; use the median of the rest.
  const used = taps.slice(2).sort((a, b) => a - b);
  const median = used.length ? used[Math.floor(used.length / 2)] : 0;
  const spread = used.length > 2 ? used[used.length - 1] - used[0] : 0;
  const result = Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, Math.round(median)));
  const done = taps.length >= NEEDED;
  const steadiness = used.length > 2 ? (spread < 60 ? 'Steady' : spread < 120 ? 'Fair' : 'Loose · try again') : '—';

  return (
    <Dialog title="Sync calibration" eyebrow="Audio" onClose={onClose} actions={
      <>
        <Button variant="quiet" sound="back" onClick={onClose}>Cancel</Button>
        <Button variant="ghost" onClick={() => setTaps([])} disabled={taps.length === 0}>Start over</Button>
        <Button variant="primary" disabled={!done} onClick={() => { store.updateSettings({ audioOffsetMs: result }); onApplied(result); onClose(); }}>
          Apply {formatMs(result)}
        </Button>
      </>
    }>
      <p>Tap the pad, or press <kbd>Space</kbd>, exactly on each click you hear. {NEEDED} taps are needed; the first two only find the pulse.</p>
      <button type="button" class={`tap-pad cut ${done ? 'is-done' : ''}`} onPointerDown={(e) => { e.preventDefault(); tap(); }}>
        <span class="tap-pad__count mono">{Math.min(taps.length, NEEDED)}<small>/{NEEDED}</small></span>
        <span class="tap-pad__dots">{Array.from({ length: NEEDED }, (_, i) => <i key={i} class={i < taps.length ? 'is-on' : ''} />)}</span>
        <span class="tap-pad__hint">{done ? 'Measured' : 'Tap here'}</span>
      </button>
      <div class="calib">
        <div><span>Measured offset</span><b class="mono">{used.length ? formatMs(result) : '—'}</b></div>
        <div><span>Consistency</span><b class="mono">{steadiness}</b></div>
        <div><span>Current setting</span><b class="mono">{formatMs(previous.current)}</b></div>
      </div>
    </Dialog>
  );
}
