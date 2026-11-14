import { getLevel } from '../../../game/levels/index.ts';
import { achievementName } from '../../../game/progression/achievements.ts';
import { careerSummary, hasUnlockDate, milestones, type Tally } from '../../../game/progression/career.ts';
import { findChassis, findPaint } from '../../../game/progression/cosmetics.ts';
import type { Profile } from '../../../game/progression/profile.ts';
import { ChassisIcon } from '../../components/chassis.tsx';
import { IconArrow } from '../../components/icons.tsx';
import { formatTime, useApp } from '../../context.ts';
import { count, formatDay, formatShortDay } from './format.ts';

/** Where each sync rank begins, as a share of all actions. Mirrors `syncRank`. */
const RANK_MARKS: [string, number][] = [['C', 35], ['B', 55], ['A', 75], ['S', 90]];

function TallyRow({ label, tally, pips }: { label: string; tally: Tally; pips?: boolean }) {
  const full = tally.have >= tally.of;
  return (
    <div class={`tally ${full ? 'is-full' : ''}`}>
      <span class="tally__k">{label}</span>
      {pips ? (
        <span class="tally__pips" aria-hidden="true">{Array.from({ length: tally.of }, (_, i) => <i key={i} class={i < tally.have ? 'is-on' : ''} />)}</span>
      ) : (
        <span class="tally__bar" aria-hidden="true"><i style={{ width: `${tally.of > 0 ? (tally.have / tally.of) * 100 : 0}%` }} /></span>
      )}
      <span class="tally__v mono"><b>{tally.have}</b><i>/{tally.of}</i></span>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <svg class="career__ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={r} class="career__ring-track" />
      <circle cx="50" cy="50" r={r} class="career__ring-fill" stroke-dasharray={`${c * Math.min(1, Math.max(0, value))} ${c}`} transform="rotate(-90 50 50)" />
    </svg>
  );
}

export function CareerPanel({ profile: p, onAchievement, onTrack }: {
  profile: Profile; onAchievement: (id: string) => void; onTrack: (id: string) => void;
}) {
  const app = useApp();
  const c = careerSummary(p);
  const m = milestones(p);
  const t = p.totals;
  const chassis = findChassis(p.loadout.chassis);
  const open = (fn: () => void) => () => { app.sound('click'); fn(); };

  return (
    <section class="career" aria-label="Career">
      <div class="career__top">
        <div class="career__id">
          <div class="career__badge">
            <Ring value={c.completion} />
            <ChassisIcon chassis={chassis} primary={findPaint(p.loadout.primary).hex} secondary={findPaint(p.loadout.secondary).hex} size="100%" class="career__chassis" />
          </div>
          <div class="career__who">
            <span class="eyebrow">Career</span>
            <p class="career__pct"><b class="mono">{c.completionPercent}</b><i>%</i><span>complete</span></p>
            <p class="career__since">
              Playing since {formatDay(c.since)}
              {c.veteran && <em class="career__tag">Alpha veteran</em>}
            </p>
            <p class="career__how">Tracks, shards, achievements and earnable cosmetics, weighted equally.</p>
          </div>
        </div>
        <div class="career__tallies">
          <TallyRow label="Levels cleared" tally={c.tracks} pips />
          <TallyRow label="Stars" tally={c.stars} />
          <TallyRow label="Shards" tally={c.shards} />
          <TallyRow label="Cosmetics" tally={c.cosmetics} />
          <TallyRow label="Achievements" tally={c.achievements} />
        </div>
      </div>

      <dl class="stats">
        <div><dt>Attempts</dt><dd class="mono">{count(t.attempts)}</dd></div>
        <div><dt>Crashes</dt><dd class="mono">{count(t.deaths)}</dd></div>
        <div><dt>Jumps</dt><dd class="mono">{count(t.jumps)}</dd></div>
        <div><dt>Orbs · pads</dt><dd class="mono">{count(t.orbs)}<i> · </i>{count(t.pads)}</dd></div>
        <div><dt>Time in levels</dt><dd class="mono">{formatTime(t.playSeconds)}</dd></div>
        <div class="stats__sync">
          <dt>On-beat accuracy</dt>
          <dd class="mono">
            {c.accuracy ? <>{c.accuracy.percent}<i>%</i><em class={`rank rank--${c.accuracy.rank}`}>{c.accuracy.rank}</em></> : '—'}
          </dd>
          <span class="gauge" role="img"
            aria-label={c.accuracy ? `Rank ${c.accuracy.rank}. Ranks begin at ${RANK_MARKS.map(([k, v]) => `${k} ${v} percent`).join(', ')}.` : 'No actions recorded yet'}>
            <i class="gauge__fill" style={{ width: `${c.accuracy ? c.accuracy.rate * 100 : 0}%` }} />
            {RANK_MARKS.map(([k, v]) => <b key={k} style={{ left: `${v}%` }}>{k}</b>)}
          </span>
        </div>
      </dl>

      <div class="marks">
        {m.latest ? (
          <button type="button" class="mark" onClick={open(() => onAchievement(m.latest!.id))}>
            <span class="mark__k">Latest unlock</span>
            <span class="mark__v">{achievementName(m.latest.id)}</span>
            <span class="mark__sub mono">{hasUnlockDate(m.latest.at) ? formatShortDay(m.latest.at) : 'Completed'}</span>
            <IconArrow size={14} class="mark__go" />
          </button>
        ) : (
          <div class="mark mark--empty"><span class="mark__k">Latest unlock</span><span class="mark__v">Nothing yet</span><span class="mark__sub">No achievement is unlocked so far.</span></div>
        )}
        {m.closest ? (
          <button type="button" class="mark" onClick={open(() => onAchievement(m.closest!.def.id))}>
            <span class="mark__k">Closest achievement</span>
            <span class="mark__v">{m.closest.def.name}</span>
            <span class="mark__sub mono">{count(m.closest.current)} / {count(m.closest.goal)}</span>
            <IconArrow size={14} class="mark__go" />
          </button>
        ) : (
          <div class="mark mark--empty"><span class="mark__k">Closest achievement</span><span class="mark__v">None counting</span>
            <span class="mark__sub">{c.achievements.have >= c.achievements.of ? 'Every achievement is complete.' : 'No counter has started yet.'}</span></div>
        )}
        {m.nextTrack ? (
          <button type="button" class="mark" onClick={open(() => onTrack(m.nextTrack!.id))}>
            <span class="mark__k">Next track to clear</span>
            <span class="mark__v">{getLevel(m.nextTrack.id).meta.name}</span>
            <span class="mark__sub mono">Best {m.nextTrack.best}%</span>
            <IconArrow size={14} class="mark__go" />
          </button>
        ) : (
          <div class="mark mark--empty"><span class="mark__k">Next track to clear</span><span class="mark__v">All cleared</span>
            <span class="mark__sub">Every track is finished in Normal mode.</span></div>
        )}
      </div>
    </section>
  );
}
