const news = { viewed: ['v2-2-0', 'v2-1-1', 'v2-1-0', 'v2-0-1', 'v2-0-0', 'update-1-1', 'update-1-0', 'v2-3-0'], notified: 'v2-3-0' };
const day = (d) => Date.UTC(2026, 10, d, 15, 34);
export const mid = {
  version: 2, createdAt: Date.UTC(2026, 10, 2), news,
  levels: {
    genesis: { best: 100, practiceBest: 100, completed: true, practiceCompleted: true, attempts: 34, completions: 3, shards: 7, bestSync: 43 / 58, bestStreak: 13, fewestAttempts: 6 },
    velocity: { best: 100, practiceBest: 64, completed: true, practiceCompleted: false, attempts: 58, completions: 1, shards: 3, bestSync: 0.7564, bestStreak: 19, fewestAttempts: 21 },
    overdrive: { best: 71, practiceBest: 100, completed: false, practiceCompleted: true, attempts: 47, completions: 0, shards: 0, bestSync: -1, bestStreak: 11, fewestAttempts: 0 },
    quantum: { best: 12, practiceBest: 38, completed: false, practiceCompleted: false, attempts: 9, completions: 0, shards: 0, bestSync: -1, bestStreak: 4, fewestAttempts: 0 },
    apex: { best: 0, practiceBest: 0, completed: false, practiceCompleted: false, attempts: 0, completions: 0, shards: 0, bestSync: -1, bestStreak: 0, fewestAttempts: 0 },
  },
  totals: { attempts: 148, deaths: 139, jumps: 1840, orbs: 96, pads: 212, actions: 1936, synced: 1340, playSeconds: 3125, completions: 4, practiceRuns: 31 },
  achievements: { 'first-light': day(3), 'collector-1': day(3), rehearsal: day(3), momentum: day(6), 'in-sync': day(6), persistent: day(8), 'frequent-flyer': day(9), marathon: day(9) },
  seen: ['intro:done'],
};
export const fresh = null;
