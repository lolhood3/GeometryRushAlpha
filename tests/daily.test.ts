import assert from 'node:assert/strict';
import { test } from 'node:test';
import { replay, solve } from '../src/game/dev/solver.ts';
import { VERIFY } from '../src/game/dev/verify.ts';
import { dateKey, dayNumber, isDateKey, keyOfDay, previousKey } from '../src/game/levels/calendar.ts';
import { buildDaily, daily, dailyPlan, referenceReplay, refreshDaily } from '../src/game/levels/daily.ts';
import { DAILY_ID, LEVEL_IDS, getLevel } from '../src/game/levels/index.ts';
import { entriesOf, isRemixOrder, partsOf, remixLevel, remixReplay } from '../src/game/levels/remix.ts';
import { REMIXES } from '../src/game/levels/remixes.ts';
import { REPLAYS } from '../src/game/levels/replays.ts';
import { routeOf } from '../src/game/levels/route.ts';
import { getSong } from '../src/game/music/songs.ts';
import { trackChallenges, challengeTally, challengeTotal } from '../src/game/progression/career.ts';
import { starsEarned } from '../src/game/progression/cosmetics.ts';
import { levelSignature } from '../src/game/progression/ghosts.ts';
import {
  dailyStreak, defaultProfile, emptyRecord, isLevelUnlocked, levelRecord, sanitizeProfile, totalShards,
} from '../src/game/progression/profile.ts';
import { ProfileStore, type RunReport } from '../src/game/progression/store.ts';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};
const run = (over: Partial<RunReport>): RunReport => ({
  levelId: 'genesis', practice: false, completed: false, died: true, progress: 0.4, seconds: 20, jumps: 10, orbs: 0, pads: 0,
  actions: 10, synced: 5, bestStreak: 3, shards: 0, sessionAttempts: 1, ...over,
});
const noon = (key: string): Date => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };

test('calendar: day keys are local dates and step back across months and leap years', () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(dateKey(new Date(2026, 10, 16, 0, 0)), '2026-11-16');
  assert.equal(previousKey('2026-03-01'), '2026-02-28');
  assert.equal(previousKey('2024-03-01'), '2024-02-29');
  assert.equal(previousKey('2026-01-01'), '2025-12-31');
  assert.equal(keyOfDay(dayNumber('2026-11-16')), '2026-11-16');
  assert.equal(dayNumber('2026-11-17') - dayNumber('2026-11-16'), 1);
  for (const bad of ['', '2026-13-01', '2026-02-30', '16-11-2026', 20261116, null]) assert.equal(isDateKey(bad), false, String(bad));
  assert.equal(isDateKey('2026-11-16'), true);
});

for (const id of LEVEL_IDS) {
  test(`${id}: every stored remix order is cleared by the rearranged reference run with all shards`, () => {
    const source = getLevel(id);
    const parts = partsOf(source, getSong(source.meta.song));
    const entries = entriesOf(source, REPLAYS[id], parts);
    const orders = REMIXES[id];
    assert.ok(orders.length >= 10, `${orders.length} orders`);
    assert.equal(new Set(orders).size, orders.length, 'no order is stored twice');
    for (const text of orders) {
      const order = [...text].map(Number);
      assert.ok(isRemixOrder(order, parts.length), text);
      assert.notEqual(text, parts.map((_, i) => i).join(''), 'the original order is not a remix');
      const level = remixLevel(source, parts, entries, order, { ...source.meta, id: DAILY_ID });
      const out = replay(level, remixReplay(source, REPLAYS[id], parts, order));
      assert.ok(out.won, `${text}: died at beat ${out.beat.toFixed(1)}`);
      assert.equal(out.shards, 7, text);
      assert.equal(level.endBeat, source.endBeat);
      assert.equal(replay(level, []).won, false, `${text}: an idle player must not win`);
    }
  });

  test(`${id}: a remix is beatable inside the track's own timing budget`, () => {
    const source = getLevel(id);
    const parts = partsOf(source, getSong(source.meta.song));
    const entries = entriesOf(source, REPLAYS[id], parts);
    const order = [...REMIXES[id][0]].map(Number);
    const level = remixLevel(source, parts, entries, order, { ...source.meta, id: DAILY_ID });
    const r = solve(level, { ...VERIFY[id], maxNodes: 3_000_000 });
    assert.ok(r.ok, `stuck at beat ${r.maxBeat.toFixed(1)} of ${level.endBeat}: ${r.death}`);
  });
}

test('daily: the plan depends only on the date and uses every track once in each five days', () => {
  const start = dayNumber('2026-11-16');
  const first = Math.floor(start / LEVEL_IDS.length) * LEVEL_IDS.length;
  for (let block = 0; block < 12; block++) {
    const seen = new Set<string>();
    for (let i = 0; i < LEVEL_IDS.length; i++) {
      const key = keyOfDay(first + block * LEVEL_IDS.length + i);
      const plan = dailyPlan(key);
      assert.deepEqual(plan, dailyPlan(key));
      assert.ok(REMIXES[plan.source].includes(plan.order.join('')), `${key}: ${plan.order.join('')}`);
      seen.add(plan.source);
    }
    assert.equal(seen.size, LEVEL_IDS.length, `block ${block}`);
  }
  // The rotation is not the same every block.
  const blocks = new Set<string>();
  for (let block = 0; block < 12; block++) {
    blocks.add(Array.from({ length: 5 }, (_, i) => dailyPlan(keyOfDay(first + block * 5 + i)).source).join(','));
  }
  assert.ok(blocks.size > 3, `${blocks.size} different rotations in twelve blocks`);
});

test('daily: sixty days in a row each build a level its own replay clears, with a song of the same length', () => {
  const start = dayNumber('2026-11-16');
  const sigs = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const d = buildDaily(keyOfDay(start + i));
    const source = getLevel(d.source);
    assert.equal(d.level.meta.id, DAILY_ID);
    assert.equal(d.level.meta.index, -1);
    assert.equal(d.level.meta.stars, 0);
    assert.equal(d.level.endBeat, source.endBeat);
    const bars = (song: { sections: { bars: number }[] }) => song.sections.reduce((n, s) => n + s.bars, 0);
    assert.equal(bars(d.song), bars(getSong(source.meta.song)));
    assert.equal(d.song.id, DAILY_ID);
    const out = replay(d.level, d.replay);
    assert.ok(out.won, `${d.key} (${d.source} ${d.order.join('')}) died at beat ${out.beat.toFixed(1)}`);
    sigs.add(levelSignature(d.level));
  }
  assert.ok(sigs.size >= 40, `${sigs.size} different remixes in sixty days`);
});

test('daily: the level, its song, its replay and its route are all today\'s, and stay put until refreshed', () => {
  const a = refreshDaily(noon('2026-11-16'));
  assert.equal(daily(), a);
  assert.equal(getLevel(DAILY_ID), a.level);
  assert.equal(getSong(DAILY_ID), a.song);
  assert.equal(referenceReplay(DAILY_ID), a.replay);
  assert.equal(referenceReplay('genesis'), REPLAYS.genesis);
  assert.equal(refreshDaily(noon('2026-11-16')), a, 'the same day gives the same object');
  const route = routeOf(DAILY_ID);
  assert.equal(route.sections.length, a.parts.length);
  assert.ok(Math.abs(route.share.reduce((x, y) => x + y, 0) - 1) < 1e-6);

  const b = refreshDaily(noon('2026-11-17'));
  assert.notEqual(b, a);
  assert.equal(getLevel(DAILY_ID), b.level);
  assert.equal(getSong(DAILY_ID), b.song);
  assert.notEqual(levelSignature(b.level), levelSignature(a.level), 'yesterday\'s ghost does not fit today');
  assert.equal(routeOf(DAILY_ID).sections.length, b.parts.length);
  assert.equal((LEVEL_IDS as readonly string[]).includes(DAILY_ID), false, 'the daily is not one of the tracks');
});

test('daily: runs are kept apart from the tracks, and a clear counts once a day towards the streak', () => {
  const store = new ProfileStore(memory());
  const p = () => store.profile;
  assert.equal(isLevelUnlocked(p(), DAILY_ID), true);

  refreshDaily(noon('2026-11-16'));
  store.beginAttempt(DAILY_ID, false);
  let out = store.recordRun(run({ levelId: DAILY_ID, progress: 0.52 }));
  assert.equal(out.newBest, true);
  assert.equal(p().daily.date, '2026-11-16');
  assert.equal(p().daily.record.best, 52);
  assert.equal(p().daily.streak, 0);
  assert.equal(dailyStreak(p(), '2026-11-16'), 0);

  // Practice never counts.
  store.beginAttempt(DAILY_ID, true);
  out = store.recordRun(run({ levelId: DAILY_ID, practice: true, completed: true, died: false, progress: 1 }));
  assert.equal(out.dailyStreak, 0);
  assert.equal(p().daily.lastClear, '');

  store.beginAttempt(DAILY_ID, false);
  out = store.recordRun(run({ levelId: DAILY_ID, completed: true, died: false, progress: 1, shards: 7, synced: 9 }));
  assert.equal(out.dailyStreak, 1);
  assert.equal(out.newShards, 0);
  assert.equal(out.unlockedLevel, null);
  assert.deepEqual(out.challenges, []);
  assert.deepEqual([p().daily.streak, p().daily.clears, p().daily.lastClear], [1, 1, '2026-11-16']);
  assert.equal(p().daily.record.shards, 0, 'the remix banks no shards');
  assert.equal(totalShards(p()), 0);
  assert.equal(starsEarned(p()), 0);
  assert.deepEqual(p().levels.genesis, emptyRecord());
  assert.equal(isLevelUnlocked(p(), 'velocity'), false, 'the daily opens no track');
  assert.equal(p().lastLevel, 'genesis');

  // A second clear the same day changes nothing.
  store.beginAttempt(DAILY_ID, false);
  out = store.recordRun(run({ levelId: DAILY_ID, completed: true, died: false, progress: 1 }));
  assert.equal(out.dailyStreak, 0);
  assert.deepEqual([p().daily.streak, p().daily.clears], [1, 1]);

  // The next day starts a new record and extends the streak.
  refreshDaily(noon('2026-11-17'));
  assert.equal(levelRecord(p(), DAILY_ID, '2026-11-17').best, 0, 'yesterday\'s best is not shown for today');
  assert.equal(dailyStreak(p(), '2026-11-17'), 1, 'still alive until the day is over');
  store.beginAttempt(DAILY_ID, false);
  assert.equal(p().daily.record.attempts, 1);
  assert.equal(p().daily.record.completed, false);
  out = store.recordRun(run({ levelId: DAILY_ID, completed: true, died: false, progress: 1 }));
  assert.equal(out.dailyStreak, 2);
  assert.deepEqual([p().daily.streak, p().daily.clears, p().daily.lastClear], [2, 2, '2026-11-17']);

  // A missed day starts again from one.
  assert.equal(dailyStreak(p(), '2026-11-19'), 0);
  refreshDaily(noon('2026-11-19'));
  store.beginAttempt(DAILY_ID, false);
  out = store.recordRun(run({ levelId: DAILY_ID, completed: true, died: false, progress: 1 }));
  assert.equal(out.dailyStreak, 1);
  assert.deepEqual([p().daily.streak, p().daily.clears], [1, 3]);

  // And it all survives a save.
  const back = sanitizeProfile(JSON.parse(JSON.stringify(p())));
  assert.deepEqual(back.daily, p().daily);
});

test('daily: a damaged or doctored save is brought back to something consistent', () => {
  const d = defaultProfile().daily;
  assert.deepEqual(sanitizeProfile({ version: 2 }).daily, d);
  assert.deepEqual(sanitizeProfile({ version: 2, daily: 'x' }).daily, d);
  const odd = sanitizeProfile({ version: 2, daily: { date: 'tomorrow', streak: -4, clears: 2.5, lastClear: 7, record: { best: 900, shards: 7 } } }).daily;
  assert.equal(odd.date, '');
  assert.equal(odd.lastClear, '');
  assert.ok(odd.streak >= 0 && Number.isInteger(odd.streak));
  assert.ok(odd.clears >= 0 && Number.isInteger(odd.clears));
  assert.ok(odd.record.best <= 100);
  assert.equal(odd.record.shards, 0);
  // A record marked cleared on a day that was never ticked off.
  const claim = sanitizeProfile({ version: 2, daily: { date: '2026-11-16', lastClear: '2026-11-10', streak: 3, clears: 3, record: { ...emptyRecord(), best: 100, completed: true, completions: 1 } } }).daily;
  assert.equal(claim.record.completed, false);
});

test('challenges: seven per track, read from the record, and reported once when a run completes them', () => {
  const empty = trackChallenges(emptyRecord());
  assert.equal(empty.length, 7);
  assert.equal(new Set(empty.map((c) => c.id)).size, 7);
  assert.equal(empty.filter((c) => c.complete).length, 0);
  for (const c of empty) assert.ok(c.goal && c.done && c.how, c.id);

  const full = trackChallenges({ ...emptyRecord(), best: 100, practiceBest: 100, completed: true, practiceCompleted: true, attempts: 2, completions: 1, shards: 7, bestSync: 0.95, bestStreak: 40, fewestAttempts: 2 });
  assert.equal(full.filter((c) => c.complete).length, 7);
  const a = trackChallenges({ ...emptyRecord(), completed: true, best: 100, bestSync: 0.8, fewestAttempts: 9, shards: 3 });
  assert.deepEqual(a.filter((c) => c.complete).map((c) => c.id), ['clear', 'rank-a']);
  assert.equal(a.find((c) => c.id === 'shards')?.status, '2 of 3');
  assert.deepEqual(challengeTally(emptyRecord()), { done: 0, of: 7 });

  const store = new ProfileStore(memory());
  assert.deepEqual(challengeTotal(store.profile), { done: 0, of: 35 });
  store.beginAttempt('genesis', false);
  let out = store.recordRun(run({ progress: 0.3 }));
  assert.deepEqual(out.challenges, []);
  store.beginAttempt('genesis', false);
  out = store.recordRun(run({ completed: true, died: false, progress: 1, shards: 3, actions: 20, synced: 16, bestStreak: 8, sessionAttempts: 2 }));
  assert.deepEqual([...out.challenges].sort(), ['clean', 'clear', 'rank-a']);
  store.beginAttempt('genesis', false);
  out = store.recordRun(run({ completed: true, died: false, progress: 1, shards: 7, actions: 20, synced: 19, bestStreak: 8, sessionAttempts: 3 }));
  assert.deepEqual([...out.challenges].sort(), ['rank-s', 'shards'], 'only what this run added');
  store.beginAttempt('genesis', true);
  out = store.recordRun(run({ practice: true, completed: true, died: false, progress: 1 }));
  assert.deepEqual(out.challenges, ['practice']);
  assert.equal(challengeTotal(store.profile).done, 6);
});
