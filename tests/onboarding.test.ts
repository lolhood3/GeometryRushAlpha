import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLevel } from '../src/game/levels/index.ts';
import {
  INTRO_AGAIN, INTRO_DONE, INTRO_END_BEAT, INTRO_LEVEL, INTRO_STEPS, IntroTracker, introEndPercent, introWanted,
} from '../src/game/onboarding.ts';
import { defaultProfile, sanitizeProfile } from '../src/game/progression/profile.ts';
import { ProfileStore } from '../src/game/progression/store.ts';

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test('intro: about twenty seconds over the opening of the first track', () => {
  const level = getLevel(INTRO_LEVEL);
  assert.equal(level.meta.index, 0, 'the intro runs on the first track');
  const seconds = INTRO_END_BEAT * level.beatDur;
  assert.ok(seconds > 15 && seconds < 30, `${seconds.toFixed(1)} s`);
  assert.deepEqual(INTRO_STEPS.map((s) => s.id), ['jump', 'beat', 'shards', 'hold']);
  for (let i = 1; i < INTRO_STEPS.length; i++) assert.ok(INTRO_STEPS[i].from > INTRO_STEPS[i - 1].from);
  assert.ok(INTRO_STEPS[INTRO_STEPS.length - 1].from < INTRO_END_BEAT);
  assert.ok(introEndPercent() > 20 && introEndPercent() < 60);
});

test('intro: shown to a new player, and not to one who is already past it', () => {
  const p = defaultProfile();
  assert.equal(introWanted(p), true);

  const early = defaultProfile();
  early.levels.genesis.best = introEndPercent() - 1;
  assert.equal(introWanted(early), true, 'still stuck inside the opening');

  const past = defaultProfile();
  past.levels.genesis.best = introEndPercent();
  assert.equal(introWanted(past), false, 'a save from before the intro existed');

  const practised = defaultProfile();
  practised.levels.genesis.practiceBest = 80;
  assert.equal(introWanted(practised), false);

  const cleared = defaultProfile();
  cleared.levels.genesis.completed = true;
  cleared.levels.genesis.best = 100;
  assert.equal(introWanted(cleared), false);
});

test('intro: finishing or skipping is remembered, and it can be asked for again', () => {
  const mem = memory();
  const store = new ProfileStore(mem);
  assert.equal(introWanted(store.profile), true);
  store.updateSeen([INTRO_DONE], [INTRO_AGAIN]);
  assert.equal(introWanted(store.profile), false);
  store.flush();
  assert.equal(introWanted(new ProfileStore(mem).profile), false, 'survives a reload');

  store.updateSeen([INTRO_AGAIN], [INTRO_DONE]);
  assert.equal(introWanted(store.profile), true);
  assert.equal(introWanted(sanitizeProfile(JSON.parse(JSON.stringify(store.profile)))), true, 'survives export and import');
  store.updateSeen([INTRO_DONE], [INTRO_AGAIN]);
  assert.deepEqual(store.profile.seen.filter((k) => k.startsWith('intro:')), [INTRO_DONE]);

  const before = store.profile;
  store.updateSeen([INTRO_DONE], [INTRO_AGAIN]);
  assert.equal(store.profile, before, 'no change, no write');
  store.flush();
});

test('intro: steps follow the track and are ticked off by what the player does', () => {
  const t = new IntroTracker();
  assert.deepEqual(t.view(-2), { step: 0, done: false }, 'the count-in shows the first step');
  t.jumped(1, 0);
  assert.deepEqual(t.view(3), { step: 0, done: true });

  assert.deepEqual(t.view(8), { step: 1, done: false });
  t.jumped(2, 1);
  assert.equal(t.view(10).done, false, 'one on-beat jump is not a streak');
  t.jumped(3, 2);
  assert.equal(t.view(11).done, true);

  assert.equal(t.view(20).step, 2);
  assert.equal(t.view(33).step, 3);
  assert.equal(t.view(33).done, false);
  t.jumped(4, 0);
  t.jumped(5, 0);
  assert.equal(t.view(36).done, false, 'separate presses are not a hold');
  t.jumped(5, 0);
  assert.equal(t.view(37).done, true, 'two jumps on one press is a hold');

  assert.equal(t.finished(INTRO_END_BEAT - 0.01), false);
  assert.equal(t.finished(INTRO_END_BEAT), true);
});

test('intro: a hold is not credited across attempts', () => {
  const t = new IntroTracker();
  t.jumped(1, 0);
  t.attempt();
  t.jumped(1, 0);
  assert.equal(t.view(34).done, false, 'press 1 of two different attempts');
  // What was learnt in an earlier attempt stays learnt.
  assert.equal(t.view(2).done, true);
});
