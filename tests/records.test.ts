import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getLevel, LEVEL_IDS } from '../src/game/levels/index.ts';
import { REPLAYS } from '../src/game/levels/replays.ts';
import { ACHIEVEMENTS, evaluateAchievements } from '../src/game/progression/achievements.ts';
import { ACHIEVEMENT_INFO, UNDESCRIBED } from '../src/game/progression/achievementInfo.ts';
import {
  ACHIEVEMENT_FILTERS, achievementCounts, achievementViews, careerSummary, filterAchievements, hasUnlockDate,
  milestones, newUnlocks, rewardFor, seenKey, streakFeat, trackRows,
} from '../src/game/progression/career.ts';
import { CHASSIS, PAINTS, TRAILS, isUnlocked } from '../src/game/progression/cosmetics.ts';
import { STORAGE_KEY, defaultProfile, syncPercent, syncRank, type Profile } from '../src/game/progression/profile.ts';
import { ProfileStore, type RunReport } from '../src/game/progression/store.ts';
import { Sim } from '../src/game/sim/sim.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

const run = (over: Partial<RunReport>): RunReport => ({
  levelId: 'genesis', practice: false, completed: false, died: true, progress: 0.4, seconds: 20, jumps: 10, orbs: 0, pads: 0,
  actions: 10, synced: 5, bestStreak: 3, shards: 0, sessionAttempts: 1, ...over,
});

const view = (p: Profile, id: string) => achievementViews(p).find((v) => v.def.id === id)!;

/** Plays a reference replay to the end and reports it exactly as the game does. */
function replayReport(id: string, sessionAttempts = 1): RunReport {
  const sim = new Sim(getLevel(id));
  const toggles = REPLAYS[id];
  let i = 0;
  let held = false;
  while (!sim.dead && !sim.won && sim.tick < 200000) {
    while (i < toggles.length && toggles[i] <= sim.tick) { held = !held; i++; }
    sim.setInput(held);
    sim.step();
  }
  assert.equal(sim.won, true, `${id} replay wins`);
  return {
    levelId: id, practice: false, completed: true, died: false, progress: sim.progress, seconds: sim.tick / 240,
    jumps: sim.jumps, orbs: sim.orbs, pads: sim.pads, actions: sim.actions, synced: sim.synced,
    bestStreak: sim.bestStreak, shards: sim.shards, sessionAttempts,
  };
}

test('every achievement is described, numbered and has an emblem', () => {
  assert.deepEqual(UNDESCRIBED, []);
  assert.equal(Object.keys(ACHIEVEMENT_INFO).length, ACHIEVEMENTS.length);
  const emblems = readFileSync(new URL('../src/ui/screens/records/emblems.tsx', import.meta.url), 'utf8');
  for (const a of ACHIEVEMENTS) {
    assert.ok(ACHIEVEMENT_INFO[a.id].rules.length > 0, `${a.id} has rules`);
    assert.ok(new RegExp(`^\\s+'?${a.id}'?: \\{`, 'm').test(emblems), `${a.id} has an emblem`);
  }
  assert.deepEqual(achievementViews(defaultProfile()).map((v) => v.number), ACHIEVEMENTS.map((_, i) => i + 1));
});

test('a new save: nothing started, nothing completed, counts add up', () => {
  const p = defaultProfile();
  const views = achievementViews(p);
  const counts = achievementCounts(views);
  assert.deepEqual(counts, { all: 20, progress: 0, completed: 0, locked: 20 });
  for (const v of views) {
    assert.equal(v.current, 0, v.def.id);
    assert.equal(v.percent, 0);
    assert.equal(v.unlockedAt, null);
  }
  const c = careerSummary(p);
  assert.equal(c.completionPercent, 0);
  assert.equal(c.accuracy, null);
  assert.deepEqual(milestones(p), { latest: null, closest: null, nextTrack: { id: 'genesis', best: 0 } });
});

test('progress shown is the definition\'s own value, never capped or invented', () => {
  const store = new ProfileStore(memory());
  for (let i = 0; i < 12; i++) { store.beginAttempt('genesis', false); store.recordRun(run({ jumps: 100, orbs: 8, bestStreak: 19 })); }
  const p = store.profile;
  for (const v of achievementViews(p)) {
    const [cur, goal] = v.def.progress(p);
    assert.equal(v.current, cur, v.def.id);
    assert.equal(v.goal, goal, v.def.id);
    assert.equal(v.status === 'completed', v.def.id in p.achievements, v.def.id);
    if (v.status === 'completed') assert.ok(cur >= goal, `${v.def.id} completed means the target is met`);
    else assert.ok(cur < goal, `${v.def.id} under target is not completed`);
    assert.equal(v.percent === 100, cur >= goal, v.def.id);
  }
  // The definition stops counting at its target; the detail view shows the save's own total beside it.
  const flyer = view(p, 'frequent-flyer');
  assert.deepEqual([flyer.current, flyer.goal, flyer.status], [1000, 1000, 'completed']);
  assert.deepEqual(flyer.info.related!(p), { label: 'Jumps made', value: '1,200' });
  assert.deepEqual([view(p, 'orbital').current, view(p, 'orbital').goal, view(p, 'orbital').percent], [96, 100, 96]);
  // Locked In, as in the screenshot: 19 of 25 is 76%, in progress, and both figures come from the same pair.
  const streak = view(p, 'streak');
  assert.deepEqual([streak.current, streak.goal, streak.percent, streak.status], [19, 25, 76, 'progress']);
  assert.equal(streakFeat(), 25);
  assert.deepEqual([view(p, 'persistent').current, view(p, 'persistent').status], [12, 'progress']);
});

test('filters partition the collection and keep its order', () => {
  const store = new ProfileStore(memory());
  store.beginAttempt('genesis', false);
  store.recordRun(replayReport('genesis'));
  const views = achievementViews(store.profile);
  const counts = achievementCounts(views);
  assert.deepEqual(ACHIEVEMENT_FILTERS.map((f) => f.id), ['all', 'progress', 'completed', 'locked']);
  assert.equal(counts.all, 20);
  assert.equal(counts.progress + counts.completed + counts.locked, 20);
  const seen = new Set<string>();
  for (const f of ['progress', 'completed', 'locked'] as const) {
    const list = filterAchievements(views, f);
    assert.equal(list.length, counts[f]);
    for (const v of list) { assert.equal(v.status, f); assert.ok(!seen.has(v.def.id)); seen.add(v.def.id); }
    assert.deepEqual(list.map((v) => v.number), list.map((v) => v.number).sort((a, b) => a - b));
  }
  assert.equal(seen.size, 20);
  assert.equal(filterAchievements(views, 'all').length, 20);
  assert.ok(counts.completed > 0 && counts.progress > 0 && counts.locked > 0);
});

test('real runs: the reference replays produce the statistics Records shows', () => {
  const store = new ProfileStore(memory());
  let jumps = 0;
  let orbs = 0;
  let actions = 0;
  let synced = 0;
  for (const id of LEVEL_IDS) {
    const r = replayReport(id);
    jumps += r.jumps; orbs += r.orbs; actions += r.actions; synced += r.synced;
    store.beginAttempt(id, false);
    const out = store.recordRun(r);
    const rec = store.profile.levels[id];
    assert.equal(out.firstCompletion, true);
    assert.equal(rec.shards, 7, `${id} banks all three shards`);
    assert.equal(rec.bestStreak, r.bestStreak);
    assert.ok(Math.abs(rec.bestSync - r.synced / r.actions) < 1e-12);
    assert.equal(rec.fewestAttempts, 1);
    assert.equal(rec.attempts, 1);
  }
  const p = store.profile;
  assert.deepEqual([p.totals.jumps, p.totals.orbs, p.totals.actions, p.totals.synced, p.totals.attempts], [jumps, orbs, actions, synced, 5]);
  const c = careerSummary(p);
  assert.deepEqual([c.tracks, c.stars, c.shards], [{ have: 5, of: 5 }, { have: 30, of: 30 }, { have: 15, of: 15 }]);
  assert.equal(c.accuracy!.percent, syncPercent(synced / actions));
  assert.equal(c.accuracy!.rank, syncRank(synced / actions));
  assert.ok(c.completionPercent < 100, 'a first pass through the game is not everything');
  for (const id of ['first-light', 'momentum', 'airborne', 'superposition', 'summit', 'collector-1', 'collector-2', 'collector-3', 'in-sync', 'clean-run', 'half-way', 'all-stars']) {
    assert.equal(view(p, id).status, 'completed', id);
  }
  // The replays chain at most 13 on-beat actions and peak at rank A, so these stay open, with their true values.
  const longest = Math.max(...LEVEL_IDS.map((id) => p.levels[id].bestStreak));
  assert.deepEqual([view(p, 'streak').current, view(p, 'streak').status], [longest, 'progress']);
  assert.ok(longest < 25);
  assert.equal(view(p, 'perfect-sync').status, 'locked');
  assert.deepEqual([view(p, 'frequent-flyer').current, view(p, 'orbital').current, view(p, 'persistent').current], [jumps, orbs, 5]);
  const rows = trackRows(p);
  assert.ok(rows.every((r) => r.open && r.allShards && r.cleanClear && !r.streakFeat));
  assert.ok(rows.filter((r) => r.topSync).length <= 1 && rows.filter((r) => r.topStreak).length <= 1);
  assert.equal(milestones(p).nextTrack, null);
});

test('attempt achievements unlock on the attempt that reaches the target, and are reported once', () => {
  const store = new ProfileStore(memory());
  for (let i = 0; i < 99; i++) store.beginAttempt('genesis', false);
  assert.equal(view(store.profile, 'persistent').status, 'progress');
  assert.equal(isUnlocked(CHASSIS.find((c) => c.id === 'phantom')!.unlock, store.profile), false);
  store.beginAttempt('genesis', true);
  assert.deepEqual([view(store.profile, 'persistent').current, view(store.profile, 'persistent').status], [100, 'completed']);
  assert.equal(isUnlocked(CHASSIS.find((c) => c.id === 'phantom')!.unlock, store.profile), true, 'the reward comes with it');
  const out = store.recordRun(run({ practice: true }));
  assert.ok(out.achievements.includes('persistent'), 'the run that follows still reports it');
  assert.ok(out.cosmetics.some((k) => k.endsWith('phantom')));
  store.beginAttempt('genesis', false);
  assert.ok(!store.recordRun(run({})).achievements.includes('persistent'), 'and only once');
});

test('a save whose counters already meet a target is granted on load, and stays granted', () => {
  const p = defaultProfile();
  p.totals.attempts = 100;
  p.totals.jumps = 1000;
  p.totals.orbs = 99;
  const mem = memory({ [STORAGE_KEY]: JSON.stringify(p) });
  const store = new ProfileStore(mem);
  assert.equal(view(store.profile, 'persistent').status, 'completed');
  assert.equal(view(store.profile, 'frequent-flyer').status, 'completed');
  assert.equal(view(store.profile, 'orbital').status, 'progress');
  assert.ok(hasUnlockDate(view(store.profile, 'persistent').unlockedAt));
  store.flush();
  const at = store.profile.achievements.persistent;

  // Next session: same grant, same date, nothing new.
  const again = new ProfileStore(memory({ [STORAGE_KEY]: mem.data.get(STORAGE_KEY)! }));
  assert.equal(again.profile.achievements.persistent, at);
  assert.deepEqual(evaluateAchievements(again.profile), []);

  // A granted achievement is never taken back, even if the save's counter is later lower.
  const lower = JSON.parse(mem.data.get(STORAGE_KEY)!);
  lower.totals.attempts = 3;
  const kept = new ProfileStore(memory({ [STORAGE_KEY]: JSON.stringify(lower) }));
  assert.deepEqual([view(kept.profile, 'persistent').status, view(kept.profile, 'persistent').current], ['completed', 3]);
  assert.equal(kept.profile.achievements.persistent, at);
});

test('rewards are the cosmetics that name the achievement, owned exactly when it is completed', () => {
  const linked = [...CHASSIS, ...PAINTS, ...TRAILS].filter((c) => c.unlock.kind === 'achievement');
  assert.equal(linked.length, 7);
  const withReward = ACHIEVEMENTS.filter((a) => rewardFor(a.id) !== null);
  assert.equal(withReward.length, 7);
  const p = defaultProfile();
  for (const a of withReward) {
    const reward = rewardFor(a.id)!;
    const item = linked.find((c) => c.id === reward.id)!;
    assert.ok(item, `${a.id} → ${reward.id}`);
    assert.equal(item.unlock.kind === 'achievement' && item.unlock.id, a.id);
    assert.equal(isUnlocked(item.unlock, p), false);
    p.achievements[a.id] = Date.now();
    assert.equal(isUnlocked(item.unlock, p), true);
  }
});

test('new-unlock flags: recent, unseen, and cleared once Records has been left', () => {
  const now = Date.UTC(2026, 10, 13);
  const store = new ProfileStore(memory());
  store.profile.achievements['first-light'] = now - 3600_000;
  store.profile.achievements.momentum = now - 10 * 24 * 3600_000;
  store.profile.achievements.summit = 0;
  assert.deepEqual(newUnlocks(store.profile, now), ['first-light']);
  assert.equal(hasUnlockDate(0), false);
  store.markSeen([seenKey('first-light')]);
  assert.deepEqual(newUnlocks(store.profile, now), []);
  assert.deepEqual(milestones(store.profile).latest, { id: 'first-light', at: now - 3600_000 });
});

test('sync percentages never claim a rank the rate has not reached', () => {
  assert.equal(syncPercent(0.746), 74);
  assert.equal(syncRank(0.746), 'B');
  assert.equal(syncPercent(0.75), 75);
  assert.equal(syncRank(0.75), 'A');
  assert.equal(syncPercent(0.8999), 89);
  assert.equal(syncPercent(0.9), 90);
  assert.equal(syncPercent(1), 100);
  assert.equal(syncPercent(-1), 0);
  for (let i = 0; i <= 1000; i++) {
    const rate = i / 1000;
    const shown = syncPercent(rate) / 100;
    assert.ok(shown <= rate + 1e-9);
    assert.equal(syncRank(shown) === 'S', syncRank(shown) === 'S' && syncRank(rate) === 'S');
  }
});

test('overall completion reaches 100 only when everything is done', () => {
  const p = defaultProfile();
  for (const id of LEVEL_IDS) Object.assign(p.levels[id], { completed: true, best: 100, shards: 7, completions: 1, bestSync: 0.95, bestStreak: 30, fewestAttempts: 1, practiceCompleted: true });
  Object.assign(p.totals, { attempts: 500, jumps: 1000, orbs: 100, playSeconds: 1800, actions: 100, synced: 95 });
  const before = careerSummary(p);
  assert.deepEqual(before.achievements, { have: 0, of: 20 });
  assert.ok(before.completionPercent >= 50 && before.completionPercent < 75, 'tracks and shards done, no achievements granted yet');
  evaluateAchievements(p);
  const c = careerSummary(p);
  assert.deepEqual(c.achievements, { have: 20, of: 20 });
  assert.equal(c.cosmetics.have, c.cosmetics.of);
  assert.equal(c.completionPercent, 100);
  assert.equal(milestones(p).closest, null);
});
