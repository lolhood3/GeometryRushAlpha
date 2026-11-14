import { getLevel, LEVEL_IDS } from '../levels/index.ts';
import { ACHIEVEMENTS } from './achievements.ts';
import { starsEarned } from './cosmetics.ts';
import { type Profile, syncPercent, syncRank, totalShards } from './profile.ts';

/**
 * Presentation data for the achievements: which family each belongs to, the
 * exact rules the game applies, and a related figure from the save.
 *
 * Nothing here decides whether an achievement is unlocked. That stays with
 * `progress()` in achievements.ts; this file only explains it.
 */
export type AchievementGroup = 'tracks' | 'collection' | 'rhythm' | 'dedication';

export const GROUP_LABEL: Record<AchievementGroup, string> = {
  tracks: 'Tracks', collection: 'Collection', rhythm: 'Rhythm', dedication: 'Dedication',
};

/** A fact read straight from the save that relates to a requirement. It is context, never a progress value. */
export interface RelatedFigure { label: string; value: string }

export interface AchievementInfo {
  group: AchievementGroup;
  /** What the counter counts, for achievements with a target above one. */
  unit?: string;
  /** How the requirement is judged, as the game actually applies it. */
  rules: string[];
  related?: (p: Profile) => RelatedFigure | null;
}

const name = (id: string): string => getLevel(id).meta.name;

function clearTrack(id: string): AchievementInfo {
  return {
    group: 'tracks',
    rules: [`Reach the end of ${name(id)} in Normal mode.`, 'A Practice clear does not count.'],
    related: (p) => {
      const r = p.levels[id];
      if (r.completed) return { label: 'Clears', value: String(r.completions) };
      return r.attempts > 0 ? { label: 'Best run so far', value: `${r.best}%` } : null;
    },
  };
}

const SHARD_RULES = [
  'A shard is banked when you finish the Normal run you collected it in.',
  'Shards picked up before a crash, or in Practice, are not banked.',
];
const shards = (): AchievementInfo => ({
  group: 'collection', unit: 'shards', rules: SHARD_RULES,
  related: (p) => ({ label: 'Shards banked', value: `${totalShards(p)}` }),
});

const STAR_RULES = [
  'Stars are awarded for clearing a track in Normal mode.',
  LEVEL_IDS.map((id) => `${name(id)} ${getLevel(id).meta.stars}`).join(' · '),
];
const stars = (): AchievementInfo => ({
  group: 'collection', unit: 'stars', rules: STAR_RULES,
  related: (p) => ({ label: 'Stars earned', value: `${starsEarned(p)}` }),
});

function bestSync(p: Profile): RelatedFigure | null {
  let best = '';
  let rate = -1;
  for (const id of LEVEL_IDS) if (p.levels[id].bestSync > rate) { rate = p.levels[id].bestSync; best = id; }
  if (rate < 0) return null;
  return { label: 'Best sync on a cleared track', value: `${syncRank(rate)} · ${syncPercent(rate)}% (${name(best)})` };
}

const syncRules = (percent: number, rank: string): string[] => [
  `Finish a track in Normal mode with at least ${percent}% of your actions on the beat (rank ${rank}).`,
  'Jumps and orb hits are the actions. One is on the beat when it lands within a tenth of a beat of an eighth note.',
  'Only the run that reaches the end is judged.',
];

const attempts = (): AchievementInfo => ({
  group: 'dedication', unit: 'attempts',
  rules: ['Every attempt counts, on any track.', 'Normal and Practice attempts both count, including each restart from a checkpoint.'],
  related: (p) => ({ label: 'Attempts made', value: p.totals.attempts.toLocaleString('en-US') }),
});

export const ACHIEVEMENT_INFO: Record<string, AchievementInfo> = {
  'first-light': clearTrack('genesis'),
  momentum: clearTrack('velocity'),
  airborne: clearTrack('overdrive'),
  superposition: clearTrack('quantum'),
  summit: clearTrack('apex'),
  'collector-1': shards(),
  'collector-2': shards(),
  'collector-3': shards(),
  'in-sync': { group: 'rhythm', rules: syncRules(75, 'A'), related: bestSync },
  'perfect-sync': { group: 'rhythm', rules: syncRules(90, 'S'), related: bestSync },
  streak: {
    group: 'rhythm', unit: 'in a row',
    rules: [
      'Land 25 on-beat actions in a row within a single Normal attempt.',
      'Jumps and orb hits are the actions. One that misses the beat starts the chain again.',
      'An attempt that ends in a crash still counts. Practice attempts do not.',
    ],
    related: (p) => {
      let best = '';
      let n = 0;
      for (const id of LEVEL_IDS) if (p.levels[id].bestStreak > n) { n = p.levels[id].bestStreak; best = id; }
      return n > 0 ? { label: 'Longest chain', value: `×${n} (${name(best)})` } : null;
    },
  },
  rehearsal: {
    group: 'tracks',
    rules: ['Reach the end of any track in Practice mode.', 'Checkpoints may be used.'],
    related: (p) => {
      let best = '';
      let pct = 0;
      for (const id of LEVEL_IDS) if (p.levels[id].practiceBest > pct) { pct = p.levels[id].practiceBest; best = id; }
      return pct > 0 ? { label: 'Furthest in Practice', value: `${pct}% (${name(best)})` } : null;
    },
  },
  'clean-run': {
    group: 'dedication',
    rules: [
      'Clear a track in Normal mode on the first, second or third attempt after starting it.',
      'The count begins when you start the track from the menu and includes Practice attempts made before the clear. Leaving the track starts it again.',
    ],
    related: (p) => {
      let best = '';
      let n = 0;
      for (const id of LEVEL_IDS) {
        const f = p.levels[id].fewestAttempts;
        if (f > 0 && (n === 0 || f < n)) { n = f; best = id; }
      }
      return n > 0 ? { label: 'Fewest attempts to a clear', value: `${n} (${name(best)})` } : null;
    },
  },
  persistent: attempts(),
  relentless: attempts(),
  'frequent-flyer': {
    group: 'dedication', unit: 'jumps',
    rules: ['Jumps on any track count, in Normal and in Practice.', 'They are added when an attempt ends or is left.'],
    related: (p) => ({ label: 'Jumps made', value: p.totals.jumps.toLocaleString('en-US') }),
  },
  orbital: {
    group: 'dedication', unit: 'orbs',
    rules: ['Orbs triggered on any track count, in Normal and in Practice.', 'Jump pads are counted separately and do not count here.'],
    related: (p) => ({ label: 'Orbs triggered', value: p.totals.orbs.toLocaleString('en-US') }),
  },
  'half-way': stars(),
  'all-stars': stars(),
  marathon: {
    group: 'dedication', unit: 'minutes',
    rules: ['Time counts while a run is in motion, in Normal and in Practice.', 'Menus, pauses and count-ins are not counted. Only whole minutes are shown.'],
    related: (p) => {
      const s = Math.floor(p.totals.playSeconds);
      return { label: 'Time in levels', value: `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` };
    },
  },
};

export function achievementInfo(id: string): AchievementInfo {
  return ACHIEVEMENT_INFO[id] ?? { group: 'dedication', rules: [] };
}

/** Ids defined in achievements.ts that have no entry here. Empty unless someone forgot one. */
export const UNDESCRIBED = ACHIEVEMENTS.map((a) => a.id).filter((id) => !(id in ACHIEVEMENT_INFO));
