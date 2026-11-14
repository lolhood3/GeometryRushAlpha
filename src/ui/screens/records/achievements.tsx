import { useEffect, useRef, useState } from 'preact/hooks';
import { GROUP_LABEL } from '../../../game/progression/achievementInfo.ts';
import {
  ACHIEVEMENT_FILTERS, achievementCounts, filterAchievements, hasUnlockDate,
  type AchievementFilter, type AchievementStatus, type AchievementView, type Reward,
} from '../../../game/progression/career.ts';
import { findChassis, findPaint } from '../../../game/progression/cosmetics.ts';
import type { Profile } from '../../../game/progression/profile.ts';
import { ChassisIcon } from '../../components/chassis.tsx';
import { Button, Dialog } from '../../components/controls.tsx';
import { IconCheck, IconLock } from '../../components/icons.tsx';
import { useApp } from '../../context.ts';
import { Emblem } from './emblems.tsx';
import { count, formatMoment, formatShortDay } from './format.ts';

const STATUS_LABEL: Record<AchievementStatus, string> = { completed: 'Completed', progress: 'In progress', locked: 'Locked' };
const EMPTY: Record<AchievementFilter, string> = {
  all: 'There are no achievements.',
  progress: 'Nothing is counting right now. Counters start with your first attempts, jumps, orbs, shards and stars.',
  completed: 'Nothing completed yet.',
  locked: 'Nothing is locked: every achievement is completed or under way.',
};
const no = (n: number): string => String(n).padStart(2, '0');
/** The share shown beside a counter. A counter that has started never reads as nothing. */
const share = (v: AchievementView): string => (v.percent === 0 && v.current > 0 ? '<1%' : `${v.percent}%`);

// The filter is kept while the app is open, so coming back to Records shows the same view.
let lastFilter: AchievementFilter = 'all';

function StatusIcon({ status }: { status: AchievementStatus }) {
  if (status === 'completed') return <IconCheck size={12} />;
  if (status === 'locked') return <IconLock size={11} />;
  return <i class="ach-pip" />;
}

function RewardIcon({ reward, profile: p, owned }: { reward: Reward; profile: Profile; owned: boolean }) {
  const primary = findPaint(p.loadout.primary).hex;
  if (reward.kind === 'chassis') {
    return <ChassisIcon chassis={findChassis(reward.id)} primary={primary} secondary={findPaint(p.loadout.secondary).hex} size={18} locked={!owned} class="reward__icon" />;
  }
  if (reward.kind === 'paint') return <i class="reward__icon reward__icon--paint" style={{ background: findPaint(reward.id).hex }} />;
  return <i class={`reward__icon reward__icon--trail reward__icon--${reward.id}`} style={{ '--p': primary } as never} />;
}

function RewardChip({ v, profile }: { v: AchievementView; profile: Profile }) {
  if (!v.reward) return null;
  const owned = v.status === 'completed';
  return (
    <span class={`reward ${owned ? 'is-owned' : ''}`}>
      <RewardIcon reward={v.reward} profile={profile} owned={owned} />
      <span class="reward__text"><i>{owned ? 'Unlocked' : 'Reward'}</i><b>{v.reward.name} {v.reward.kind}</b></span>
    </span>
  );
}

function Card({ v, profile, fresh, onOpen }: { v: AchievementView; profile: Profile; fresh: boolean; onOpen: () => void }) {
  const app = useApp();
  const state = v.status === 'completed'
    ? `Completed${hasUnlockDate(v.unlockedAt) ? ` on ${formatShortDay(v.unlockedAt)}` : ''}`
    : v.counted ? `${STATUS_LABEL[v.status]}, ${v.current} of ${v.goal}` : STATUS_LABEL[v.status];
  return (
    <button type="button" class={`ach ach--${v.status} ${fresh ? 'is-new' : ''}`} data-id={v.def.id}
      aria-label={`${v.def.name}. ${v.def.description} ${state}.${v.reward ? ` Reward: ${v.reward.name} ${v.reward.kind}.` : ''} Open details.`}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') app.sound('hover'); }}
      onClick={() => { app.sound('click'); onOpen(); }}>
      <span class="ach__top">
        <Emblem id={v.def.id} status={v.status} />
        <span class="ach__text">
          <span class="ach__no mono">{no(v.number)}<i>{GROUP_LABEL[v.info.group]}</i>{fresh && <em class="ach__new">New</em>}</span>
          <b class="ach__name">{v.def.name}</b>
          <span class="ach__desc">{v.def.description}</span>
        </span>
      </span>
      <span class="ach__foot">
        {v.status === 'progress' ? (
          <span class="ach__prog">
            <span class="ach__bar"><i style={{ width: `${(v.current / v.goal) * 100}%` }} /></span>
            <span class="ach__count mono"><b>{count(v.current)}</b><i>/{count(v.goal)}</i></span>
          </span>
        ) : (
          <span class="ach__state">
            <StatusIcon status={v.status} />
            {v.status === 'completed' ? <>Completed{hasUnlockDate(v.unlockedAt) && <i> · {formatShortDay(v.unlockedAt)}</i>}</> : 'Locked'}
            {v.status === 'locked' && v.counted && <span class="ach__count mono"><b>0</b><i>/{count(v.goal)}</i></span>}
          </span>
        )}
        <RewardChip v={v} profile={profile} />
      </span>
    </button>
  );
}

export function AchievementCenter({ views, profile, fresh, onOpen }: {
  views: AchievementView[]; profile: Profile; fresh: string[]; onOpen: (id: string, list: string[]) => void;
}) {
  const app = useApp();
  const [filter, setFilter] = useState<AchievementFilter>(lastFilter);
  const counts = achievementCounts(views);
  const shown = filterAchievements(views, filter);
  const ids = shown.map((v) => v.def.id);
  const tabs = useRef<HTMLDivElement>(null);
  const pick = (f: AchievementFilter) => {
    if (f === filter) return;
    lastFilter = f;
    app.sound('toggle', 1);
    setFilter(f);
  };
  // Left and right move between filters, as in any tab strip; the screen's own arrow handling stays out of it.
  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const i = ACHIEVEMENT_FILTERS.findIndex((f) => f.id === filter);
    const next = ACHIEVEMENT_FILTERS[(i + dir + ACHIEVEMENT_FILTERS.length) % ACHIEVEMENT_FILTERS.length].id;
    pick(next);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLElement>(`[data-filter="${next}"]`)?.focus());
  };

  return (
    <section class="rec-block" aria-label="Achievements">
      <div class="ach-bar">
        <h2 class="rec-title rec-title--bare">Achievements</h2>
        <span class="ach-bar__total mono"><b>{counts.completed}</b>/{counts.all}</span>
        <div class="ach-filter" role="tablist" aria-label="Show achievements" ref={tabs} onKeyDown={onKey}>
          {ACHIEVEMENT_FILTERS.map((f) => (
            <button type="button" key={f.id} role="tab" data-filter={f.id} aria-selected={f.id === filter} tabIndex={f.id === filter ? 0 : -1}
              class={`ach-filter__item ${f.id === filter ? 'is-on' : ''}`} onClick={() => pick(f.id)}>
              {f.label}<i class="mono">{counts[f.id]}</i>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p class="ach-empty">{EMPTY[filter]}</p>
      ) : (
        <div class="ach-grid" key={filter}>
          {shown.map((v) => <Card key={v.def.id} v={v} profile={profile} fresh={fresh.includes(v.def.id)} onOpen={() => onOpen(v.def.id, ids)} />)}
        </div>
      )}
    </section>
  );
}

export function AchievementDialog({ v, profile, position, onMove, onClose }: {
  v: AchievementView; profile: Profile;
  /** Where this achievement sits in the list it was opened from, and that list's length. */
  position: [number, number]; onMove: (dir: 1 | -1) => void; onClose: () => void;
}) {
  const app = useApp();
  const related = v.info.related?.(profile) ?? null;
  const left = v.goal - v.current;
  const owned = v.status === 'completed';
  // Reading an achievement moves the page behind to it, so closing lands beside the card.
  useEffect(() => {
    document.querySelector<HTMLElement>(`.ach[data-id="${v.def.id}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [v.def.id]);

  return (
    <Dialog class={`dialog--ach dialog--ach-${v.status}`} eyebrow={`Achievement ${no(v.number)} · ${GROUP_LABEL[v.info.group]}`} title={v.def.name} onClose={onClose}
      actions={<>
        <span class="dialog__step">
          <Button variant="quiet" size="sm" disabled={position[1] < 2} ariaLabel="Previous achievement" onClick={() => onMove(-1)}>Prev</Button>
          <span class="dialog__at mono">{position[0] + 1}/{position[1]}</span>
          <Button variant="quiet" size="sm" disabled={position[1] < 2} ariaLabel="Next achievement" onClick={() => onMove(1)}>Next</Button>
        </span>
        {v.reward && <Button variant="quiet" onClick={() => app.go('garage')}>Open Garage</Button>}
        <Button variant="ghost" sound="back" autoFocus onClick={onClose}>Close</Button>
      </>}>
      <div class="ach-detail" key={v.def.id}>
        <div class="ach-detail__lead">
          <Emblem id={v.def.id} status={v.status} size="lg" />
          <div>
            <p class="ach-detail__desc">{v.def.description}</p>
            <span class={`ach-status ach-status--${v.status}`}><StatusIcon status={v.status} />{STATUS_LABEL[v.status]}</span>
          </div>
        </div>

        <section class="ach-sec">
          <h3>Progress</h3>
          {v.status === 'completed' ? (
            <p class="ach-detail__done">
              Requirement met.{hasUnlockDate(v.unlockedAt) && <> Completed <b class="mono">{formatMoment(v.unlockedAt)}</b>.</>}
            </p>
          ) : v.counted ? (
            <div class="ach-detail__prog">
              <span class="ach__bar"><i style={{ width: `${(v.current / v.goal) * 100}%` }} /></span>
              <p class="mono">
                <b>{count(v.current)}</b><i> / {count(v.goal)}{v.info.unit ? ` ${v.info.unit}` : ''}</i>
                <span>{share(v)} · {count(left)} to go</span>
              </p>
            </div>
          ) : (
            <p class="ach-detail__todo">Not done yet. This one is a single feat, so there is no counter.</p>
          )}
          {related && <p class="ach-detail__related"><i>{related.label}</i><b class="mono">{related.value}</b></p>}
        </section>

        <section class="ach-sec">
          <h3>Requirements</h3>
          <ul class="ach-rules">{v.info.rules.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>

        <section class="ach-sec">
          <h3>Reward</h3>
          {v.reward ? (
            <div class={`ach-reward ${owned ? 'is-owned' : ''}`}>
              <span class="ach-reward__art"><RewardIcon reward={v.reward} profile={profile} owned={owned} /></span>
              <p>
                <b>{v.reward.name} {v.reward.kind}</b>
                {v.reward.blurb && <i>{v.reward.blurb}</i>}
                <span>{owned ? 'Unlocked. Equip it in the Garage.' : 'Unlocks in the Garage when this achievement is completed.'}</span>
              </p>
            </div>
          ) : (
            <p class="ach-detail__todo">No cosmetic is tied to this achievement. It counts towards career completion.</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
