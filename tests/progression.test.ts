import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACHIEVEMENTS } from '../src/game/progression/achievements.ts';
import { CHASSIS, PAINTS, TRAILS, isUnlocked, starsEarned, totalStars } from '../src/game/progression/cosmetics.ts';
import { STORAGE_KEY, defaultProfile, isLevelUnlocked, sanitizeProfile, syncRank, totalShards } from '../src/game/progression/profile.ts';
import { ProfileStore, type RunReport } from '../src/game/progression/store.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

const run = (over: Partial<RunReport>): RunReport => ({
  levelId: 'genesis', practice: false, completed: false, died: true, progress: 0.4, seconds: 20, jumps: 10, orbs: 0, pads: 0,
  actions: 10, synced: 5, bestStreak: 3, shards: 0, sessionAttempts: 1, ...over,
});

test('fresh profile: only the first level is open', () => {
  const p = defaultProfile();
  assert.equal(isLevelUnlocked(p, 'genesis'), true);
  assert.equal(isLevelUnlocked(p, 'velocity'), false);
  assert.equal(totalShards(p), 0);
  assert.equal(starsEarned(p), 0);
  assert.equal(totalStars(), 30);
});

test('a death records best progress but banks nothing', () => {
  const store = new ProfileStore(memory());
  store.beginAttempt('genesis', false);
  const out = store.recordRun(run({ progress: 0.42, shards: 0b011 }));
  assert.equal(out.newBest, true);
  assert.equal(store.profile.levels.genesis.best, 42);
  assert.equal(store.profile.levels.genesis.shards, 0);
  assert.equal(store.profile.totals.deaths, 1);
  assert.equal(isLevelUnlocked(store.profile, 'velocity'), false);
});

test('completion banks shards, grants stars, achievements and the next level', () => {
  const store = new ProfileStore(memory());
  const out = store.recordRun(run({ completed: true, progress: 1, shards: 0b101, actions: 40, synced: 38, sessionAttempts: 2 }));
  const rec = store.profile.levels.genesis;
  assert.equal(rec.completed, true);
  assert.equal(rec.best, 100);
  assert.equal(out.firstCompletion, true);
  assert.equal(out.newShards, 2);
  assert.equal(out.unlockedLevel, 'velocity');
  assert.ok(out.achievements.includes('first-light'));
  assert.ok(out.achievements.includes('perfect-sync'));
  assert.ok(out.achievements.includes('clean-run'));
  assert.ok(out.cosmetics.includes('chassis:iris'));
  assert.ok(out.cosmetics.includes('paint:lime'));
  assert.equal(starsEarned(store.profile), 2);
  // Replaying and collecting the missing shard only counts the new one.
  const again = store.recordRun(run({ completed: true, progress: 1, shards: 0b111 }));
  assert.equal(again.newShards, 1);
  assert.equal(again.firstCompletion, false);
  assert.equal(totalShards(store.profile), 3);
});

test('practice clears open the next level without stars or shards', () => {
  const store = new ProfileStore(memory());
  const out = store.recordRun(run({ practice: true, completed: true, progress: 1, shards: 0b111 }));
  assert.equal(out.unlockedLevel, 'velocity');
  assert.equal(store.profile.levels.genesis.completed, false);
  assert.equal(store.profile.levels.genesis.practiceCompleted, true);
  assert.equal(totalShards(store.profile), 0);
  assert.equal(starsEarned(store.profile), 0);
  assert.ok(out.achievements.includes('rehearsal'));
});

test('locked cosmetics cannot be equipped', () => {
  const store = new ProfileStore(memory());
  assert.equal(store.equip('chassis', 'summit'), false);
  assert.equal(store.profile.loadout.chassis, 'core');
  assert.equal(store.equip('chassis', 'vector'), true);
  assert.equal(store.equip('primary', 'gold'), false);
});

test('profile survives a save / load round trip', () => {
  const mem = memory();
  const a = new ProfileStore(mem);
  a.recordRun(run({ completed: true, progress: 1, shards: 0b111 }));
  a.equip('chassis', 'iris');
  a.updateSettings({ music: 0.3, audioOffsetMs: 40 });
  a.flush();
  const b = new ProfileStore(mem);
  assert.deepEqual(b.profile.levels, a.profile.levels);
  assert.equal(b.profile.loadout.chassis, 'iris');
  assert.equal(b.profile.settings.music, 0.3);
  assert.equal(b.profile.settings.audioOffsetMs, 40);
});

test('corrupt or hostile saves are sanitised', () => {
  const p = sanitizeProfile({ version: 2, levels: { genesis: { best: 5000, shards: 99, completed: false } }, settings: { master: 7, quality: 'ultra' }, loadout: { chassis: 12 } });
  assert.equal(p.levels.genesis.best, 99);
  assert.equal(p.levels.genesis.shards, 0);
  assert.equal(p.settings.master, 1);
  assert.equal(p.settings.quality, 'auto');
  assert.equal(p.loadout.chassis, 'core');
  const store = new ProfileStore(memory({ [STORAGE_KEY]: '{not json' }));
  assert.equal(store.profile.levels.genesis.attempts, 0);
  // A save that equips something it has not earned is repaired on load.
  const cheat = defaultProfile();
  cheat.loadout.chassis = 'summit';
  const repaired = new ProfileStore(memory({ [STORAGE_KEY]: JSON.stringify(cheat) }));
  assert.equal(repaired.profile.loadout.chassis, 'core');
});

test('alpha (v1) saves grant veteran status and carry settings over', () => {
  const store = new ProfileStore(memory({
    geometry_rush_progress_v1: JSON.stringify({ 'level-1-genesis': { completed: true } }),
    geometry_rush_settings_v1: JSON.stringify({ masterVolume: 0.5, isMuted: true, screenShake: false }),
  }));
  assert.equal(store.profile.veteran, true);
  assert.equal(store.profile.settings.master, 0.5);
  assert.equal(store.profile.settings.muted, true);
  assert.equal(store.profile.settings.shake, false);
  assert.ok(isUnlocked(CHASSIS.find((c) => c.id === 'alpha')!.unlock, store.profile));
});

test('reset keeps settings, clears progress', () => {
  const store = new ProfileStore(memory());
  store.recordRun(run({ completed: true, progress: 1 }));
  store.updateSettings({ sfx: 0.1 });
  store.resetProgress();
  assert.equal(store.profile.levels.genesis.completed, false);
  assert.equal(store.profile.settings.sfx, 0.1);
  assert.deepEqual(store.profile.achievements, {});
});

test('catalogue integrity', () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length);
  for (const item of [...CHASSIS, ...PAINTS, ...TRAILS]) {
    if (item.unlock.kind === 'achievement') assert.ok(ids.has(item.unlock.id), `${item.id} → ${item.unlock.id}`);
  }
  assert.equal(syncRank(0.95), 'S');
  assert.equal(syncRank(0.5), 'C');
});
