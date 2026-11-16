import { useMemo, useState } from 'preact/hooks';
import { daily, shortDate } from '../../game/levels/daily.ts';
import { DAILY_ID } from '../../game/levels/index.ts';
import { lockedBehind } from '../../game/progression/career.ts';
import { isLevelUnlocked, popcount3, syncPercent } from '../../game/progression/profile.ts';
import { checkCode } from '../../game/replay/code.ts';
import { pasteText } from '../clipboard.ts';
import { Button, Dialog } from '../components/controls.tsx';
import { IconCheck, IconPlay, IconShard } from '../components/icons.tsx';
import { useApp, useProfile } from '../context.ts';

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Takes a run code, replays it and shows what really happened in it. A run
 * that checks out can be raced: it runs beside the player as an outline.
 */
export function RunCodeDialog({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const profile = useProfile();
  const [text, setText] = useState('');
  const [canPaste] = useState(() => typeof navigator !== 'undefined' && !!navigator.clipboard?.readText);
  const res = useMemo(() => (text.trim() === '' ? null : checkCode(text)), [text]);

  const run = res?.ok ? res : null;
  const meta = run ? run.level.meta : null;
  // A remix can only be raced on its own day: tomorrow the level is a different one.
  const gone = run !== null && run.levelId === DAILY_ID && run.day !== daily().key;
  const locked = run !== null && !isLevelUnlocked(profile, run.levelId);
  const behind = locked && run ? lockedBehind(profile, run.levelId) : null;
  const source = run && run.levelId === DAILY_ID && run.day ? shortDate(run.day) : null;

  const race = () => {
    if (!run || gone || locked) return;
    app.game.setRival(run);
    onClose();
    app.play(run.levelId, false);
  };

  return (
    <Dialog title="Race a shared run" eyebrow="Run code" class="runcode" onClose={onClose} actions={
      <>
        <Button variant="quiet" sound="back" onClick={onClose}>Close</Button>
        {canPaste && <Button onClick={() => { void pasteText().then((t) => { if (t !== null) setText(t.trim()); }); }}>Paste</Button>}
        <Button variant="primary" sound="start" disabled={!run || gone || locked} onClick={race}><IconPlay size={14} /> Race it</Button>
      </>
    }>
      <p>Paste a code that someone copied from their results. The game plays the run again here, so what you see below is what really happened in it.</p>
      <textarea class="runcode__box mono" data-autofocus spellcheck={false} autocomplete="off" autocapitalize="off" rows={3}
        placeholder="GR2.…" aria-label="Run code" value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
      <div class="runcode__out" role="status" aria-live="polite">
        {res === null && <p class="runcode__idle">Nothing to check yet.</p>}
        {res && !res.ok && <p class="runcode__bad">{res.reason}</p>}
        {run && meta && (
          <>
            <div class="runcode__head">
              <span class="runcode__ok"><IconCheck size={13} /> Replayed and checked</span>
              <b>{meta.name}{source ? ` · ${source}` : ''}</b>
            </div>
            <dl class="runcode__facts">
              <div><dt>Result</dt><dd>{run.ending === 'cleared' ? 'Cleared' : run.ending === 'crashed' ? `Crashed at ${run.percent}%` : `Left at ${run.percent}%`}</dd></div>
              <div><dt>Sync</dt><dd class="mono">{run.jumps > 0 ? `${run.rank} · ${syncPercent(run.sync)}%` : '—'}</dd></div>
              <div><dt>Best streak</dt><dd class="mono">×{run.bestStreak}</dd></div>
              <div><dt>Shards</dt><dd><span class="shards" aria-label={`${popcount3(run.shards)} of 3`}>
                {[0, 1, 2].map((i) => <IconShard key={i} size={14} filled={(run.shards & (1 << i)) !== 0} class={(run.shards & (1 << i)) ? 'is-on' : ''} />)}
              </span></dd></div>
              <div><dt>Time</dt><dd class="mono">{clock(run.seconds)}</dd></div>
            </dl>
            {gone && <p class="runcode__note">This is the remix of {source}. Only today's remix can be played, so it cannot be raced.</p>}
            {!gone && locked && <p class="runcode__note">{meta.name} is still locked{behind ? `: clear ${behind} to open it` : ''}.</p>}
            {!gone && !locked && <p class="runcode__note">Racing puts this run on the track beside you as an outline. It runs in Normal mode.</p>}
          </>
        )}
      </div>
    </Dialog>
  );
}
