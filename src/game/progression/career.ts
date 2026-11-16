import { getLevel, LEVEL_IDS, TOTAL_SHARDS } from '../levels/index.ts';
import { ACHIEVEMENTS, type Achievement } from './achievements.ts';
import { achievementInfo, type AchievementInfo } from './achievementInfo.ts';
import { CHASSIS, PAINTS, TRAILS, isUnlocked, starsEarned, totalStars } from './cosmetics.ts';
import {
  completedCount, defaultProfile, isLevelUnlocked, popcount3, syncPercent, syncRank, totalShards, type LevelRecord, type Profile, type SyncRank,
} from './profile.ts';

/**
 * Read-only views of the save for the Records screen. Everything here is
 * derived from the profile each time it is asked for; nothing is stored.
 */

// ── Achievements ────────────────────────────────────────────────────────────

/** completed: granted. progress: counting, not there yet. locked: nothing counted towards it yet. */
export type AchievementStatus = 'completed' | 'progress' | 'locked';

export type RewardKind = 'chassis' | 'paint' | 'trail';
export interface Reward {
  kind: RewardKind;
  id: string;
  name: string;
  blurb: string;
}

/** The cosmetic an achievement unlocks, read from the cosmetics' own unlock rules. */
export function rewardFor(achievementId: string): Reward | null {
  const owns = (c: { unlock: { kind: string; id?: string } }) => c.unlock.kind === 'achievement' && c.unlock.id === achievementId;
  const chassis = CHASSIS.find(owns);
  if (chassis) return { kind: 'chassis', id: chassis.id, name: chassis.name, blurb: chassis.blurb };
  const trail = TRAILS.find(owns);
  if (trail) return { kind: 'trail', id: trail.id, name: trail.name, blurb: trail.blurb };
  const paint = PAINTS.find(owns);
  if (paint) return { kind: 'paint', id: paint.id, name: paint.name, blurb: '' };
  return null;
}

export interface AchievementView {
  def: Achievement;
  info: AchievementInfo;
  /** Position in the collection, from 1. */
  number: number;
  status: AchievementStatus;
  /** Current and target value, exactly as `def.progress` reports them. */
  current: number;
  goal: number;
  /** True when the requirement is a count rather than a single feat. */
  counted: boolean;
  /** Whole percent of the way there, rounded down: 100 only when the target is met. */
  percent: number;
  /** When it was granted, or null. */
  unlockedAt: number | null;
  reward: Reward | null;
}

export function achievementView(def: Achievement, p: Profile): AchievementView {
  const [current, goal] = def.progress(p);
  const granted = def.id in p.achievements;
  const status: AchievementStatus = granted ? 'completed' : current > 0 ? 'progress' : 'locked';
  return {
    def, info: achievementInfo(def.id), number: ACHIEVEMENTS.indexOf(def) + 1, status,
    current, goal, counted: goal > 1,
    percent: goal > 0 ? Math.min(100, Math.floor((current / goal) * 100)) : 0,
    unlockedAt: granted ? p.achievements[def.id] : null,
    reward: rewardFor(def.id),
  };
}

export const achievementViews = (p: Profile): AchievementView[] => ACHIEVEMENTS.map((a) => achievementView(a, p));

export type AchievementFilter = 'all' | AchievementStatus;
export const ACHIEVEMENT_FILTERS: readonly { id: AchievementFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'locked', label: 'Locked' },
];

export function filterAchievements(views: AchievementView[], filter: AchievementFilter): AchievementView[] {
  return filter === 'all' ? views : views.filter((v) => v.status === filter);
}

export function achievementCounts(views: AchievementView[]): Record<AchievementFilter, number> {
  const n: Record<AchievementFilter, number> = { all: views.length, progress: 0, completed: 0, locked: 0 };
  for (const v of views) n[v.status]++;
  return n;
}

/** Timestamps before this are placeholders from old or hand-made saves, not real unlock dates. */
const EARLIEST_REAL_UNLOCK = Date.UTC(2024, 0, 1);
export const hasUnlockDate = (at: number | null): at is number => at !== null && at >= EARLIEST_REAL_UNLOCK;

/** How long an unlock is flagged as new on the Records screen, unless it is looked at sooner. */
export const NEW_UNLOCK_MS = 3 * 24 * 3600 * 1000;
export const seenKey = (achievementId: string): string => `achievement:${achievementId}`;

/** Ids of achievements unlocked recently that the player has not yet seen on the Records screen. */
export function newUnlocks(p: Profile, now = Date.now()): string[] {
  return ACHIEVEMENTS.map((a) => a.id).filter((id) => {
    const at = p.achievements[id];
    return typeof at === 'number' && at <= now && now - at < NEW_UNLOCK_MS && !p.seen.includes(seenKey(id));
  });
}

// ── Career ──────────────────────────────────────────────────────────────────

export interface Tally { have: number; of: number }

export interface CareerSummary {
  tracks: Tally;
  stars: Tally;
  shards: Tally;
  /** Every cosmetic, including the ones a new profile starts with. */
  cosmetics: Tally;
  achievements: Tally;
  /** 0..1 over tracks, shards, achievements and earnable cosmetics, each weighted equally. */
  completion: number;
  /** Whole percent, rounded down, so 100 means everything. */
  completionPercent: number;
  /** Share of all actions that landed on the beat, or null before the first action. */
  accuracy: { rate: number; percent: number; rank: SyncRank } | null;
  since: number;
  veteran: boolean;
}

export function careerSummary(p: Profile): CareerSummary {
  const all = [...CHASSIS, ...PAINTS, ...TRAILS];
  const earnable = all.filter((c) => c.unlock.kind !== 'default');
  const tracks = { have: completedCount(p), of: LEVEL_IDS.length };
  const shards = { have: totalShards(p), of: TOTAL_SHARDS };
  const achievements = { have: ACHIEVEMENTS.filter((a) => a.id in p.achievements).length, of: ACHIEVEMENTS.length };
  const earned = { have: earnable.filter((c) => isUnlocked(c.unlock, p)).length, of: earnable.length };
  const parts = [tracks, shards, achievements, earned];
  const completion = parts.reduce((sum, t) => sum + (t.of > 0 ? t.have / t.of : 1), 0) / parts.length;
  const t = p.totals;
  const rate = t.actions > 0 ? t.synced / t.actions : 0;
  return {
    tracks,
    stars: { have: starsEarned(p), of: totalStars() },
    shards,
    cosmetics: { have: all.filter((c) => isUnlocked(c.unlock, p)).length, of: all.length },
    achievements,
    completion,
    completionPercent: parts.every((x) => x.have >= x.of) ? 100 : Math.min(99, Math.floor(completion * 100 + 1e-9)),
    accuracy: t.actions > 0 ? { rate, percent: syncPercent(rate), rank: syncRank(rate) } : null,
    since: p.createdAt,
    veteran: p.veteran,
  };
}

export interface Milestones {
  /** The achievement unlocked most recently. */
  latest: { id: string; at: number } | null;
  /** The unfinished achievement that is the largest share of the way to its target. */
  closest: AchievementView | null;
  /** The first open track that has not been cleared. */
  nextTrack: { id: string; best: number } | null;
}

export function milestones(p: Profile): Milestones {
  let latest: Milestones['latest'] = null;
  for (const a of ACHIEVEMENTS) {
    const at = p.achievements[a.id];
    if (typeof at === 'number' && (!latest || at > latest.at)) latest = { id: a.id, at };
  }
  let closest: AchievementView | null = null;
  for (const v of achievementViews(p)) {
    if (v.status !== 'progress') continue;
    if (!closest || v.current / v.goal > closest.current / closest.goal) closest = v;
  }
  const next = LEVEL_IDS.find((id) => !p.levels[id].completed && isLevelUnlocked(p, id));
  return { latest, closest, nextTrack: next ? { id: next, best: p.levels[next].best } : null };
}

// ── Tracks ──────────────────────────────────────────────────────────────────

export interface TrackRow {
  id: string;
  open: boolean;
  /** This track holds the player's best sync, or longest streak, of all tracks (only said when two or more have one). */
  topSync: boolean;
  topStreak: boolean;
  allShards: boolean;
  shardCount: number;
  /** The streak is long enough for the Locked In achievement. */
  streakFeat: boolean;
  /** Cleared within three attempts of starting, which is what Clean Run asks for. */
  cleanClear: boolean;
}

/** The streak the Locked In achievement asks for, read from its own definition. */
export const streakFeat = (): number => ACHIEVEMENTS.find((a) => a.id === 'streak')?.progress(defaultProfile())[1] ?? Infinity;

export function trackRows(p: Profile): TrackRow[] {
  const top = (pick: (id: string) => number, floor: number): string | null => {
    const scored = LEVEL_IDS.filter((id) => pick(id) > floor);
    if (scored.length < 2) return null;
    const best = Math.max(...scored.map(pick));
    const holders = scored.filter((id) => pick(id) === best);
    return holders.length === 1 ? holders[0] : null;
  };
  const sync = top((id) => p.levels[id].bestSync, -1);
  const streak = top((id) => p.levels[id].bestStreak, 0);
  const feat = streakFeat();
  return LEVEL_IDS.map((id) => {
    const r = p.levels[id];
    const shardCount = popcount3(r.shards);
    return {
      id, open: isLevelUnlocked(p, id), topSync: sync === id, topStreak: streak === id,
      allShards: shardCount === 3, shardCount,
      streakFeat: r.bestStreak >= feat,
      cleanClear: r.fewestAttempts > 0 && r.fewestAttempts <= CLEAN_ATTEMPTS,
    };
  });
}

// ── Challenges ──────────────────────────────────────────────────────────────

/**
 * Optional goals for one track. They are read straight from the track's
 * record, the same figures the Records screen shows, so nothing extra is
 * saved and a challenge that is done stays done: records only ever improve.
 */
export interface Challenge {
  id: 'clear' | 'shards' | 'rank-a' | 'rank-s' | 'clean' | 'streak' | 'practice';
  /** What to do, as an instruction: "Clear at sync rank S". */
  goal: string;
  /** The same thing once it is done: "Cleared at sync rank S". */
  done: string;
  /** How it is earned, in one line. */
  how: string;
  complete: boolean;
  /** Where the player stands, when there is something to say: "2 of 3", "Best A · 81%". */
  status: string;
}

/** Sync rates that earn rank A and rank S, as percentages. `syncRank` is what decides; these only word the goals. */
export const RANK_PERCENT = { a: 75, s: 90 };
/** Clean Run asks for a clear within this many attempts of starting the track. */
export const CLEAN_ATTEMPTS = 3;

/** The challenges of a track, in the order they are usually met. */
export function trackChallenges(r: LevelRecord): Challenge[] {
  const shards = popcount3(r.shards);
  const feat = streakFeat();
  const sync = r.bestSync >= 0 ? `Best ${syncRank(r.bestSync)} · ${syncPercent(r.bestSync)}%` : '';
  return [
    { id: 'clear', goal: 'Clear the track', done: 'Cleared in Normal mode', how: 'Reach the end in Normal mode.',
      complete: r.completed, status: r.completed || r.best === 0 ? '' : `Best ${r.best}%` },
    { id: 'shards', goal: 'Bank all three shards', done: 'All three shards banked', how: 'Pick them up and finish the run to keep them.',
      complete: shards === 3, status: `${shards} of 3` },
    { id: 'rank-a', goal: 'Clear at sync rank A', done: 'Cleared at sync rank A', how: `Finish a Normal run with ${RANK_PERCENT.a}% of your jumps on the beat.`,
      complete: r.bestSync >= 0 && 'SA'.includes(syncRank(r.bestSync)), status: sync },
    { id: 'rank-s', goal: 'Clear at sync rank S', done: 'Cleared at sync rank S', how: `Finish a Normal run with ${RANK_PERCENT.s}% of your jumps on the beat.`,
      complete: r.bestSync >= 0 && syncRank(r.bestSync) === 'S', status: sync },
    { id: 'streak', goal: `Hold a streak of ${feat}`, done: `Streak of ${feat} or more`, how: `Land ${feat} jumps in a row on the beat in a Normal run.`,
      complete: r.bestStreak >= feat, status: r.bestStreak > 0 ? `Best ×${r.bestStreak}` : '' },
    { id: 'clean', goal: `Clear within ${CLEAN_ATTEMPTS} attempts`, done: `Cleared within ${CLEAN_ATTEMPTS} attempts`, how: `Open the track and reach the end by your ${CLEAN_ATTEMPTS === 3 ? 'third' : `${CLEAN_ATTEMPTS}th`} try.`,
      complete: r.fewestAttempts > 0 && r.fewestAttempts <= CLEAN_ATTEMPTS, status: r.fewestAttempts > 0 ? `Best ${r.fewestAttempts}` : '' },
    { id: 'practice', goal: 'Clear it in Practice', done: 'Cleared in Practice', how: 'Reach the end in Practice mode, from the start.',
      complete: r.practiceCompleted, status: r.practiceCompleted || r.practiceBest === 0 ? '' : `Best ${r.practiceBest}%` },
  ];
}

export interface ChallengeTally { done: number; of: number }

export function challengeTally(r: LevelRecord): ChallengeTally {
  const list = trackChallenges(r);
  return { done: list.filter((c) => c.complete).length, of: list.length };
}

/** Challenges completed on every track together. */
export function challengeTotal(p: Profile): ChallengeTally {
  let done = 0;
  let of = 0;
  for (const id of LEVEL_IDS) {
    const t = challengeTally(p.levels[id]);
    done += t.done;
    of += t.of;
  }
  return { done, of };
}

/** The track that must be cleared (or finished in Practice) to open this one, if it is locked. */
export function lockedBehind(p: Profile, id: string): string | null {
  const i = (LEVEL_IDS as readonly string[]).indexOf(id);
  return i > 0 && !isLevelUnlocked(p, id) ? getLevel(LEVEL_IDS[i - 1]).meta.name : null;
}
