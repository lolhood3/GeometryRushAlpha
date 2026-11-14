import { LEVEL_IDS } from '../levels/index.ts';
import { starsEarned } from './cosmetics.ts';
import { type Profile, totalShards } from './profile.ts';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Current and target value; unlocked when current >= target. */
  progress: (p: Profile) => [number, number];
}

const flag = (v: boolean): [number, number] => [v ? 1 : 0, 1];
const cap = (v: number, target: number): [number, number] => [Math.min(v, target), target];
const any = (f: (id: string) => boolean): boolean => LEVEL_IDS.some(f);
const bestSync = (p: Profile): number => Math.max(...LEVEL_IDS.map((id) => p.levels[id].bestSync));

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-light', name: 'First Light', description: 'Complete Genesis.', progress: (p) => flag(p.levels.genesis.completed) },
  { id: 'momentum', name: 'Momentum', description: 'Complete Velocity.', progress: (p) => flag(p.levels.velocity.completed) },
  { id: 'airborne', name: 'Airborne', description: 'Complete Overdrive.', progress: (p) => flag(p.levels.overdrive.completed) },
  { id: 'superposition', name: 'Superposition', description: 'Complete Quantum.', progress: (p) => flag(p.levels.quantum.completed) },
  { id: 'summit', name: 'Summit', description: 'Complete Apex.', progress: (p) => flag(p.levels.apex.completed) },
  { id: 'collector-1', name: 'Glint', description: 'Bank 3 shards.', progress: (p) => cap(totalShards(p), 3) },
  { id: 'collector-2', name: 'Hoard', description: 'Bank 9 shards.', progress: (p) => cap(totalShards(p), 9) },
  { id: 'collector-3', name: 'Complete Set', description: 'Bank all 15 shards.', progress: (p) => cap(totalShards(p), 15) },
  { id: 'in-sync', name: 'In Sync', description: 'Finish a level with sync rank A or better.', progress: (p) => flag(bestSync(p) >= 0.75) },
  { id: 'perfect-sync', name: 'Metronome', description: 'Finish a level with sync rank S.', progress: (p) => flag(bestSync(p) >= 0.9) },
  { id: 'streak', name: 'Locked In', description: 'Chain 25 on-beat actions in one run.',
    progress: (p) => cap(Math.max(...LEVEL_IDS.map((id) => p.levels[id].bestStreak)), 25) },
  { id: 'rehearsal', name: 'Rehearsal', description: 'Clear any level in Practice mode.',
    progress: (p) => flag(any((id) => p.levels[id].practiceCompleted)) },
  { id: 'clean-run', name: 'Clean Run', description: 'Complete a level within 3 attempts of starting it.',
    progress: (p) => flag(any((id) => p.levels[id].fewestAttempts > 0 && p.levels[id].fewestAttempts <= 3)) },
  { id: 'persistent', name: 'Persistent', description: 'Make 100 attempts.', progress: (p) => cap(p.totals.attempts, 100) },
  { id: 'relentless', name: 'Relentless', description: 'Make 500 attempts.', progress: (p) => cap(p.totals.attempts, 500) },
  { id: 'frequent-flyer', name: 'Frequent Flyer', description: 'Jump 1,000 times.', progress: (p) => cap(p.totals.jumps, 1000) },
  { id: 'orbital', name: 'Orbital', description: 'Trigger 100 orbs.', progress: (p) => cap(p.totals.orbs, 100) },
  { id: 'half-way', name: 'Rising Star', description: 'Earn 12 stars.', progress: (p) => cap(starsEarned(p), 12) },
  { id: 'all-stars', name: 'All Stars', description: 'Earn all 30 stars.', progress: (p) => cap(starsEarned(p), 30) },
  { id: 'marathon', name: 'Marathon', description: 'Spend 30 minutes in levels.', progress: (p) => cap(Math.floor(p.totals.playSeconds / 60), 30) },
];

export const findAchievement = (id: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.id === id);
export const achievementName = (id: string): string => findAchievement(id)?.name ?? id;

/** Grants every achievement whose condition is now met. Returns the new ids. */
export function evaluateAchievements(p: Profile, now = Date.now()): string[] {
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (a.id in p.achievements) continue;
    const [cur, target] = a.progress(p);
    if (cur >= target) {
      p.achievements[a.id] = now;
      unlocked.push(a.id);
    }
  }
  return unlocked;
}
