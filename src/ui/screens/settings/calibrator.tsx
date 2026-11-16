import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Transport } from '../../../engine/audio/transport.ts';
import { OFFSET_MAX, OFFSET_MIN, TAPS_NEEDED, TAPS_WARMUP, measureTaps, tapError } from '../../../game/calibration.ts';
import { getSong } from '../../../game/music/songs.ts';
import { Button, Dialog } from '../../components/controls.tsx';
import { useApp, useKey } from '../../context.ts';

export { OFFSET_MAX, OFFSET_MIN };
export const formatMs = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)} ms`;

const QUALITY_TEXT = { steady: 'Steady', fair: 'Fair', loose: 'Loose' } as const;

/**
 * Tap-along latency measurement. The player taps to a click track by ear; where
 * the taps gather around the clicks is the offset (see game/calibration.ts).
 *
 * Taps are timed exactly as presses are in a run: the event's own timestamp,
 * placed on the same smoothed audio clock. Whatever small bias that path has
 * is therefore in the measurement too, which is what makes the result right
 * for play rather than merely right in the abstract.
 *
 * Once enough taps are in, the pad flashes with the click as the game would
 * now place it, so the result can be judged before it is applied.
 */
export function Calibrator({ onClose, onApplied }: { onClose: () => void; onApplied: (ms: number) => void }) {
  const app = useApp();
  const { game, store } = app;
  const [taps, setTaps] = useState<number[]>([]);
  const previous = useRef(store.profile.settings.audioOffsetMs);
  const song = getSong('metronome');
  const beat = 60 / song.bpm;
  const clock = useMemo(() => new Transport(game.audio, game.music), []);
  const pad = useRef<HTMLButtonElement>(null);
  const lastTap = useRef(-Infinity);

  const measure = measureTaps(taps, beat * 1000);
  const done = taps.length >= TAPS_NEEDED;
  const result = measure?.offsetMs ?? 0;
  const checking = done && measure !== null;
  // Nothing to judge by eye when the taps could not be trusted in the first place.
  const flashing = checking && measure.quality !== 'loose';

  useEffect(() => {
    game.audio.offsetMs = 0;
    clock.start(song, 0, 0.3, true);
    return () => {
      clock.stop(0.1);
      game.audio.offsetMs = store.profile.settings.audioOffsetMs;
      game.playMenuMusic();
    };
  }, []);

  // While measuring, the clock runs uncorrected. While checking, it runs with the result applied.
  useEffect(() => { game.audio.offsetMs = checking ? result : 0; }, [checking, result]);

  // Keeps the clock following the audio between taps, and drives the flash of the check.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const t = clock.time();
      const phase = t / beat - Math.floor(t / beat);
      pad.current?.classList.toggle('is-beat', flashing && t > 0 && phase < 0.16);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [flashing]);

  const tap = (stamp: number) => {
    if (done) return;
    // The moment the press happened, not the moment this code got to run.
    const lag = performance.now() - stamp;
    const at = lag >= 0 && lag < 250 ? stamp : performance.now();
    const t = clock.timeAt(at / 1000);
    if (!Number.isFinite(t) || t < 0) return;
    // One finger landing twice is one tap.
    if (t - lastTap.current < beat * 0.3) return;
    lastTap.current = t;
    setTaps((list) => (list.length >= TAPS_NEEDED ? list : [...list, tapError(t, beat)]));
  };
  useKey((e) => {
    if (e.code === 'Space' && !e.repeat) { e.preventDefault(); tap(e.timeStamp); }
  });
  const restart = () => { lastTap.current = -Infinity; setTaps([]); };
  const apply = () => { store.updateSettings({ audioOffsetMs: result }); onApplied(result); onClose(); };

  const loose = checking && measure.quality === 'loose';
  const advice = !checking ? null
    : measure.clamped
      ? `The sound seems to be more than ${OFFSET_MAX} ms late, which is further than the game can correct. A wired connection or the device's own speaker will play better.`
      : loose
        ? 'Those taps were too scattered to trust. Start over and tap along for a few clicks before you begin counting.'
        : 'The pad now flashes with each click as the game would time it. If the two land together, apply it.';

  return (
    <Dialog title="Sync calibration" eyebrow="Audio" class="dialog--calib" onClose={onClose} actions={
      <>
        <Button variant="quiet" sound="back" onClick={onClose}>Cancel</Button>
        <Button variant={loose ? 'primary' : 'ghost'} onClick={restart} disabled={taps.length === 0}>Start over</Button>
        <Button variant={loose ? 'ghost' : 'primary'} disabled={!checking} onClick={apply}>
          Apply {formatMs(result)}
        </Button>
      </>
    }>
      <p>
        Listen, not look: tap the pad, or press <kbd>Space</kbd>, exactly on each click you hear, the way you press in a run.
        {' '}{TAPS_NEEDED} taps are needed; the first {TAPS_WARMUP} only find the pulse.
      </p>
      <button ref={pad} type="button" class={`tap-pad cut ${done ? 'is-done' : ''} ${loose ? 'is-loose' : ''}`}
        onPointerDown={(e) => { e.preventDefault(); tap(e.timeStamp); }}>
        <span class="tap-pad__count mono">{Math.min(taps.length, TAPS_NEEDED)}<small>/{TAPS_NEEDED}</small></span>
        <span class="tap-pad__dots">{Array.from({ length: TAPS_NEEDED }, (_, i) => <i key={i} class={i < taps.length ? 'is-on' : ''} />)}</span>
        <span class="tap-pad__hint">{done ? (loose ? 'Too scattered' : 'Measured · watch the flash') : 'Tap here'}</span>
      </button>
      <div class="calib">
        <div><span>Measured offset</span><b class="mono">{measure ? formatMs(result) : '—'}</b></div>
        <div>
          <span>Consistency</span>
          <b class="mono">{measure ? `${QUALITY_TEXT[measure.quality]} · ±${Math.round(measure.spreadMs)} ms` : '—'}</b>
        </div>
        <div><span>Current setting</span><b class="mono">{formatMs(previous.current)}</b></div>
      </div>
      <p class={`calib__advice ${loose || measure?.clamped ? 'is-warn' : ''}`} role="status">
        {advice ?? (measure && measure.dropped > 0 ? `${measure.dropped} stray ${measure.dropped === 1 ? 'tap' : 'taps'} set aside.` : '\u00a0')}
      </p>
    </Dialog>
  );
}
