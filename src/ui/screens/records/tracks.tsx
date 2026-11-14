import { getLevel, LEVEL_IDS } from '../../../game/levels/index.ts';
import { lockedBehind, streakFeat, trackRows, type TrackRow } from '../../../game/progression/career.ts';
import { syncPercent, syncRank, type LevelRecord, type Profile } from '../../../game/progression/profile.ts';
import { Button, Dialog } from '../../components/controls.tsx';
import { IconArrow, IconCheck, IconLock, IconPlay, IconShard, IconStar } from '../../components/icons.tsx';
import { formatTime, useApp } from '../../context.ts';
import { count } from './format.ts';

const no = (i: number): string => String(i + 1).padStart(2, '0');

function Shards({ mask, size }: { mask: number; size: number }) {
  return <>{[0, 1, 2].map((i) => <IconShard key={i} size={size} filled={(mask & (1 << i)) !== 0} class={(mask & (1 << i)) ? 'is-on' : ''} />)}</>;
}

function Sync({ rate }: { rate: number }) {
  if (rate < 0) return <span class="trk__none">—</span>;
  const rank = syncRank(rate);
  return <><em class={`rank rank--${rank}`}>{rank}</em>{syncPercent(rate)}<i>%</i></>;
}

/** What a screen reader hears for a row: the same figures the columns show. */
function describe(name: string, r: LevelRecord, row: TrackRow): string {
  if (!row.open) return `${name}. Locked.`;
  const parts = [
    r.completed ? 'cleared' : `best ${r.best} percent`,
    `practice ${r.practiceBest} percent`,
    `${row.shardCount} of 3 shards`,
    r.bestSync >= 0 ? `sync rank ${syncRank(r.bestSync)}, ${syncPercent(r.bestSync)} percent` : 'no sync record',
    r.bestStreak > 0 ? `streak ${r.bestStreak}` : 'no streak',
    `${r.attempts} attempts`,
  ];
  return `${name}: ${parts.join(', ')}. Open track details.`;
}

export function TrackTable({ profile: p, onOpen }: { profile: Profile; onOpen: (id: string) => void }) {
  const app = useApp();
  const rows = trackRows(p);
  const marked = rows.some((r) => r.topSync || r.topStreak);
  const feat = rows.some((r) => r.streakFeat);
  return (
    <section class="rec-block" aria-label="Track records">
      <h2 class="rec-title">Tracks</h2>
      <div class="trk">
        <div class="trk__row trk__row--head" aria-hidden="true">
          <span>Track</span><span>Best</span><span>Practice</span><span>Shards</span><span>Sync</span><span>Streak</span><span>Attempts</span><span />
        </div>
        {rows.map((row) => {
          const m = getLevel(row.id).meta;
          const r = p.levels[row.id];
          return (
            <button type="button" key={row.id} class={`trk__row ${row.open ? '' : 'is-locked'} ${r.completed ? 'is-cleared' : ''}`}
              style={{ '--tab': m.themes[0].accent } as never} aria-label={describe(m.name, r, row)}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') app.sound('hover'); }}
              onClick={() => { app.sound('click'); onOpen(row.id); }}>
              <span class="trk__name">
                <i class="mono">{no(m.index)}</i>
                <b>{m.name}</b>
                {!row.open && <IconLock size={12} />}
              </span>
              <span class="trk__best mono" data-k="Best">
                <span class="trk__meter"><i style={{ width: `${r.best}%` }} /></span>
                {r.completed ? <b class="trk__clear"><IconCheck size={12} />100%</b> : <span>{r.best}<i>%</i></span>}
              </span>
              <span class={`mono ${r.practiceCompleted ? 'trk__done' : ''}`} data-k="Practice">{r.practiceBest}<i>%</i></span>
              <span class={`shards shards--sm ${row.allShards ? 'is-full' : ''}`} data-k="Shards"><Shards mask={r.shards} size={13} /></span>
              <span class={`trk__sync mono ${row.topSync ? 'is-top' : ''}`} data-k="Sync"><Sync rate={r.bestSync} /></span>
              <span class={`mono ${row.topStreak ? 'is-top' : ''} ${row.streakFeat ? 'is-feat' : ''}`} data-k="Streak">
                {r.bestStreak > 0 ? <>×{r.bestStreak}</> : <span class="trk__none">—</span>}
              </span>
              <span class="mono" data-k="Attempts">{count(r.attempts)}</span>
              <IconArrow size={14} class="trk__go" />
            </button>
          );
        })}
      </div>
      {(marked || feat) && (
        <p class="trk__legend">
          {marked && <span><i class="trk__dot" /> Your best across tracks</span>}
          {feat && <span><i class="trk__dot trk__dot--feat" /> Streak of {streakFeat()} or more</span>}
        </p>
      )}
    </section>
  );
}

export function TrackDialog({ id, profile: p, onClose, onMove }: {
  id: string; profile: Profile; onClose: () => void; onMove: (id: string) => void;
}) {
  const app = useApp();
  const level = getLevel(id);
  const m = level.meta;
  const r = p.levels[id];
  const row = trackRows(p).find((x) => x.id === id)!;
  const behind = lockedBehind(p, id);
  const i = (LEVEL_IDS as readonly string[]).indexOf(id);
  const feats: [boolean, string][] = [
    [r.completed, 'Cleared in Normal mode'],
    [r.practiceCompleted, 'Cleared in Practice'],
    [row.allShards, 'All three shards banked'],
    [r.bestSync >= 0 && 'SA'.includes(syncRank(r.bestSync)), 'Sync rank A or better'],
    [row.streakFeat, `Streak of ${streakFeat()} or more`],
    [row.cleanClear, 'Cleared within three attempts'],
  ];
  const go = (practice: boolean) => { app.setFocusLevel(id); app.play(id, practice); };

  return (
    <Dialog class="dialog--track" eyebrow={`Track ${no(m.index)} · ${m.difficulty}`} title={m.name} onClose={onClose}
      actions={<>
        <span class="dialog__step">
          <Button variant="quiet" size="sm" disabled={i <= 0} ariaLabel="Previous track" onClick={() => onMove(LEVEL_IDS[i - 1])}>Prev</Button>
          <Button variant="quiet" size="sm" disabled={i >= LEVEL_IDS.length - 1} ariaLabel="Next track" onClick={() => onMove(LEVEL_IDS[i + 1])}>Next</Button>
        </span>
        <Button variant="quiet" sound="back" autoFocus={!row.open} onClick={onClose}>Close</Button>
        {row.open && <Button variant="ghost" sound="start" onClick={() => go(true)}>Practice</Button>}
        {row.open && <Button variant="primary" sound="start" autoFocus onClick={() => go(false)}><IconPlay size={15} /> Play</Button>}
      </>}>
      <div class="track-detail" style={{ '--tab': m.themes[0].accent } as never}>
        <p class="track-detail__tag">{m.tagline}</p>
        <dl class="facts">
          <div><dt>Tempo</dt><dd class="mono">{m.bpm}<i> BPM</i></dd></div>
          <div><dt>Length</dt><dd class="mono">{formatTime(level.endBeat * level.beatDur)}</dd></div>
          <div><dt>Worth</dt><dd class="mono facts__star"><IconStar size={13} /> {m.stars}</dd></div>
          <div><dt>Shards</dt><dd class={`shards ${row.allShards ? 'is-full' : ''}`}><Shards mask={r.shards} size={15} /></dd></div>
        </dl>

        {behind ? (
          <p class="track-detail__locked"><IconLock size={16} /> Locked. Clear {behind}, or finish it in Practice, to open this track.</p>
        ) : (
          <>
            <div class="track-detail__runs">
              <div class="run"><span class="run__k">Normal</span><span class="trk__meter"><i style={{ width: `${r.best}%` }} /></span>
                <span class="run__v mono">{r.best}<i>%</i></span></div>
              <div class="run run--practice"><span class="run__k">Practice</span><span class="trk__meter"><i style={{ width: `${r.practiceBest}%` }} /></span>
                <span class="run__v mono">{r.practiceBest}<i>%</i></span></div>
            </div>
            <dl class="facts facts--records">
              <div><dt>Best sync</dt><dd class={`mono ${row.topSync ? 'is-top' : ''}`}><Sync rate={r.bestSync} /></dd></div>
              <div><dt>Longest streak</dt><dd class={`mono ${row.topStreak ? 'is-top' : ''} ${row.streakFeat ? 'is-feat' : ''}`}>{r.bestStreak > 0 ? `×${r.bestStreak}` : '—'}</dd></div>
              <div><dt>Attempts</dt><dd class="mono">{count(r.attempts)}</dd></div>
              <div><dt>Clears</dt><dd class="mono">{count(r.completions)}</dd></div>
              <div><dt>Fewest attempts to clear</dt><dd class="mono">{r.fewestAttempts > 0 ? r.fewestAttempts : '—'}</dd></div>
            </dl>
            <ul class="feats">
              {feats.map(([done, text]) => (
                <li key={text} class={done ? 'is-done' : ''}>{done ? <IconCheck size={12} /> : <i class="feats__no" />}{text}</li>
              ))}
            </ul>
            <p class="track-detail__note">Sync is taken from clears in Normal mode; streak from any Normal attempt. Fewest attempts counts one sitting, from starting the track.</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
