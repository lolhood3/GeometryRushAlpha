import { useEffect, useRef, useState } from 'preact/hooks';
import {
  MAX_SAVE_CHARS, checkSave, isBlankSave, summarizeSave, type RestorePoint, type SaveCheck, type SaveProblem, type SaveSummary,
} from '../../../game/progression/store.ts';
import { Button, Dialog, FieldText } from '../../components/controls.tsx';
import { formatTime, useApp, useProfile } from '../../context.ts';
import { Group, Row, type Notify } from './parts.tsx';

const PROBLEMS: Record<SaveProblem, string> = {
  empty: 'That file is empty, so there is nothing to import.',
  'too-large': 'That file is far too large to be a Geometry Rush save.',
  'not-json': 'That file could not be read. It is not a save file, or it is damaged.',
  'not-a-save': 'That file is not a Geometry Rush V.2 save.',
  'other-version': 'That save comes from a different version of Geometry Rush and cannot be imported here.',
};
const REASONS: Record<RestorePoint['reason'], string> = {
  import: 'replaced by an import',
  reset: 'erased by a reset',
  restore: 'replaced by a restore',
};

const when = (at: number) => (at > 0
  ? new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'an unknown time');
const stamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Fact = { key: keyof SaveSummary; label: string; show: (s: SaveSummary) => string };
const FACTS: Fact[] = [
  { key: 'cleared', label: 'Tracks cleared', show: (s) => `${s.cleared}/${s.tracks}` },
  { key: 'stars', label: 'Stars', show: (s) => String(s.stars) },
  { key: 'shards', label: 'Shards', show: (s) => `${s.shards}/${s.tracks * 3}` },
  { key: 'achievements', label: 'Achievements', show: (s) => String(s.achievements) },
  { key: 'attempts', label: 'Attempts', show: (s) => s.attempts.toLocaleString() },
  { key: 'playSeconds', label: 'Play time', show: (s) => formatTime(s.playSeconds) },
];

function SaveFacts({ s }: { s: SaveSummary }) {
  return (
    <dl class="save-facts">
      {FACTS.map((f) => <div key={f.key}><dt>{f.label}</dt><dd class="mono">{f.show(s)}</dd></div>)}
    </dl>
  );
}

/** Two saves side by side, so the player can see what a replacement would cost. */
function Compare({ current, incoming, incomingLabel }: { current: SaveSummary; incoming: SaveSummary; incomingLabel: string }) {
  return (
    <table class="save-compare">
      <thead><tr><th scope="col"><span class="sr">Measure</span></th><th scope="col">On this device</th><th scope="col">{incomingLabel}</th></tr></thead>
      <tbody>
        {FACTS.map((f) => {
          const less = (incoming[f.key] as number) < (current[f.key] as number);
          return (
            <tr key={f.key}>
              <th scope="row">{f.label}</th>
              <td class="mono">{f.show(current)}</td>
              <td class={`mono ${less ? 'is-less' : ''}`}>{f.show(incoming)}{less && <span class="sr"> (less)</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const hasLess = (current: SaveSummary, incoming: SaveSummary) =>
  (['cleared', 'stars', 'shards', 'achievements'] as const).some((k) => incoming[k] < current[k]);

/** A button that only acts after being held down, for the one action here that destroys something. */
function HoldButton({ label, onDone, duration = 1300 }: { label: string; onDone: () => void; duration?: number }) {
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);
  const done = useRef(false);
  const cancel = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    if (!done.current) setProgress(0);
  };
  const begin = () => {
    if (raf.current || done.current) return;
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / duration);
      setProgress(p);
      if (p >= 1) { done.current = true; raf.current = 0; onDone(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <button type="button" class={`btn btn--danger btn--md hold ${progress > 0 ? 'is-holding' : ''}`} style={`--p:${progress.toFixed(3)}`}
      aria-label={`${label}. Hold for ${Math.round(duration / 100) / 10} seconds to confirm.`}
      onPointerDown={(e) => { if (e.pointerType !== 'mouse' || e.button === 0) begin(); }}
      onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel} onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={cancel}>
      <span class="hold__fill" aria-hidden="true" />
      <span class="btn__label">{progress > 0 ? 'Keep holding…' : label}</span>
    </button>
  );
}

type Pending =
  | { kind: 'import'; name: string; json: string; check: Extract<SaveCheck, { ok: true }> }
  | { kind: 'reset' }
  | { kind: 'restore'; point: RestorePoint };

export function SaveDataPane({ notify, clearNotice }: { notify: Notify; clearNotice: () => void }) {
  const app = useApp();
  const { store } = app;
  const profile = useProfile();
  const [pending, setPending] = useState<Pending | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const summary = summarizeSave(profile);
  const blank = isBlankSave(profile);
  const point = store.restorePoint();
  const close = () => setPending(null);

  const undo = (text: string) => ({
    label: 'Undo',
    run: () => {
      if (store.restorePrevious()) { app.sound('unlock'); notify({ tone: 'ok', text }); }
      else { app.sound('deny'); notify({ tone: 'error', text: 'The previous save is no longer available.' }); }
    },
  });

  const exportSave = (): boolean => {
    const name = `geometry-rush-v2-save-${stamp()}.json`;
    try {
      const url = URL.createObjectURL(new Blob([store.exportSave()], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify({ tone: 'ok', text: `Exported as ${name}. Look in your downloads.` });
      return true;
    } catch {
      app.sound('deny');
      notify({ tone: 'error', text: 'The save could not be exported from this browser.' });
      return false;
    }
  };

  const pick = async (f: File | undefined) => {
    if (file.current) file.current.value = '';
    if (!f) return;
    const fail = (problem: SaveProblem) => { app.sound('deny'); notify({ tone: 'error', text: PROBLEMS[problem] }); };
    if (f.size > MAX_SAVE_CHARS) { fail('too-large'); return; }
    let json: string;
    try { json = await f.text(); } catch { fail('not-json'); return; }
    const check = checkSave(json);
    if (!check.ok) { fail(check.problem); return; }
    clearNotice();
    setPending({ kind: 'import', name: f.name, json, check });
  };

  const applyImport = (json: string) => {
    close();
    try {
      store.importSave(json);
    } catch {
      app.sound('deny');
      notify({ tone: 'error', text: 'The save could not be imported. Nothing on this device was changed.' });
      return;
    }
    app.sound('unlock');
    const kept = store.restorePoint()?.reason === 'import';
    notify(kept
      ? { tone: 'ok', text: 'Save imported. The save it replaced is kept as a restore point.', action: undo('Import undone. Your earlier save is back.') }
      : { tone: 'ok', text: 'Save imported.' });
  };

  const applyReset = () => {
    close();
    store.resetProgress();
    app.sound('toggle', 0);
    const kept = store.restorePoint()?.reason === 'reset';
    notify(kept
      ? { tone: 'warn', text: 'Progress erased. A restore point was kept.', action: undo('Reset undone. Your progress is back.') }
      : { tone: 'warn', text: 'Progress erased.' });
  };

  const applyRestore = () => {
    close();
    if (store.restorePrevious()) { app.sound('unlock'); notify({ tone: 'ok', text: 'Earlier save restored. The save it replaced is now the restore point.' }); }
    else { app.sound('deny'); notify({ tone: 'error', text: 'The restore point could not be read.' }); }
  };

  return (
    <>
      <Group title="On this device">
        <SaveFacts s={summary} />
        <p class={`set-status ${store.readOnly ? 'is-warn' : ''}`}>
          <i aria-hidden="true" />
          {store.readOnly
            ? 'This browser is blocking storage. Progress will be lost when the page closes, so export a file to keep it.'
            : 'Saved in this browser, automatically. Clearing the browser\'s site data deletes it; an exported file does not depend on the browser.'}
        </p>
      </Group>

      <Group title="Backup file">
        <Row>
          <FieldText label="Export save" hint="Downloads your progress and settings as a file, to keep as a backup or to move to another device." />
          <Button variant="ghost" size="sm" onClick={() => { exportSave(); }}>Export</Button>
        </Row>
        <Row>
          <FieldText label="Import save" hint="Loads a previously exported file. You see what it contains before anything is replaced." />
          <Button variant="ghost" size="sm" onClick={() => file.current?.click()}>Choose file</Button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void pick((e.target as HTMLInputElement).files?.[0])} />
        </Row>
      </Group>

      {point && (
        <Group title="Restore point">
          <Row>
            <FieldText label={`Save ${REASONS[point.reason]}`}
              hint={`Kept on ${when(point.at)} · ${point.summary.cleared}/${point.summary.tracks} tracks cleared · ${point.summary.stars} stars · ${point.summary.attempts.toLocaleString()} attempts`} />
            <Button variant="ghost" size="sm" onClick={() => setPending({ kind: 'restore', point })}>Restore</Button>
          </Row>
        </Group>
      )}

      <Group title="Erase">
        <Row class="field--danger">
          <FieldText label="Reset progress"
            hint={blank ? 'There is no progress on this device to erase.' : 'Erases records, stars, shards, achievements and unlocks. Settings and key bindings are kept.'} />
          <Button variant="danger" size="sm" disabled={blank} onClick={() => setPending({ kind: 'reset' })}>Reset</Button>
        </Row>
      </Group>

      {pending?.kind === 'import' && (
        <Dialog title="Replace this save?" eyebrow="Import save" onClose={close} actions={
          <>
            <Button variant="quiet" sound="back" autoFocus onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={() => applyImport(pending.json)}>Import and replace</Button>
          </>
        }>
          <p>
            <b class="dialog__file">{pending.name}</b> will replace the progress and settings on this device.
            {hasLess(summary, pending.check.summary) && <span class="dialog__warn"> The file holds less progress than this device does.</span>}
          </p>
          <Compare current={summary} incoming={pending.check.summary} incomingLabel="In the file" />
          <p class="dialog__fine">
            {blank
              ? 'There is no progress on this device to lose.'
              : store.readOnly
                ? 'This browser is blocking storage, so no restore point can be kept: export the current save first if you may want it back.'
                : 'The save on this device is kept as a restore point, so the import can be undone from Save data.'}
          </p>
        </Dialog>
      )}

      {pending?.kind === 'reset' && (
        <Dialog title="Erase all progress?" eyebrow="Reset progress" tone="danger" onClose={close} actions={
          <>
            <Button variant="ghost" size="sm" class="dialog__aside" onClick={() => { exportSave(); }}>Export a copy</Button>
            <Button variant="quiet" sound="back" autoFocus onClick={close}>Keep my progress</Button>
            <HoldButton label="Hold to erase" onDone={applyReset} />
          </>
        }>
          <p>This erases everything earned on this device:</p>
          <ul class="erase-list">
            <li><b class="mono">{summary.cleared}/{summary.tracks}</b> tracks cleared, with every record and best run</li>
            <li><b class="mono">{summary.stars}</b> stars and <b class="mono">{summary.shards}</b> shards</li>
            <li><b class="mono">{summary.achievements}</b> achievements and every unlocked cosmetic</li>
            <li><b class="mono">{summary.attempts.toLocaleString()}</b> attempts and <b class="mono">{formatTime(summary.playSeconds)}</b> of play time</li>
          </ul>
          <p class="dialog__fine">
            Settings and key bindings are kept.{' '}
            {store.readOnly
              ? 'This browser is blocking storage, so no restore point can be kept: export a copy first if you may want this back.'
              : 'A restore point is kept in this browser, so the reset can be undone from Save data until another save replaces it.'}
          </p>
        </Dialog>
      )}

      {pending?.kind === 'restore' && (
        <Dialog title="Restore the earlier save?" eyebrow="Restore point" onClose={close} actions={
          <>
            <Button variant="quiet" sound="back" autoFocus onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={applyRestore}>Restore</Button>
          </>
        }>
          <p>
            The save {REASONS[pending.point.reason]} on {when(pending.point.at)} will replace the one on this device, including its settings.
            {hasLess(summary, pending.point.summary) && <span class="dialog__warn"> It holds less progress than this device does now.</span>}
          </p>
          <Compare current={summary} incoming={pending.point.summary} incomingLabel="Restore point" />
          <p class="dialog__fine">
            {blank ? 'There is no progress on this device to lose.' : 'The current save becomes the restore point, so this can be undone the same way.'}
          </p>
        </Dialog>
      )}
    </>
  );
}
