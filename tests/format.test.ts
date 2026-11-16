import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkLevel } from '../src/game/dev/check.ts';
import { PLAYTEST_ID, loadPlaytest } from '../src/game/dev/playtest.ts';
import { replay } from '../src/game/dev/solver.ts';
import { buildApex } from '../src/game/levels/apex.ts';
import { referenceReplay } from '../src/game/levels/daily.ts';
import {
  LEVEL_FORMAT, OPS, docFromBuilder, formatDoc, levelFromDoc, loadLevel, parseLevelDoc, type LevelDoc,
} from '../src/game/levels/format.ts';
import { buildGenesis } from '../src/game/levels/genesis.ts';
import { LEVEL_IDS, getLevel } from '../src/game/levels/index.ts';
import { buildOverdrive } from '../src/game/levels/overdrive.ts';
import { buildQuantum } from '../src/game/levels/quantum.ts';
import { REPLAYS } from '../src/game/levels/replays.ts';
import { buildVelocity } from '../src/game/levels/velocity.ts';
import { getSong } from '../src/game/music/songs.ts';
import { levelSignature } from '../src/game/progression/ghosts.ts';
import { ProfileStore } from '../src/game/progression/store.ts';
import { LevelBuilder, type Level } from '../src/game/sim/level.ts';

const BUILT_IN: Record<string, () => Level> = {
  genesis: buildGenesis, velocity: buildVelocity, overdrive: buildOverdrive, quantum: buildQuantum, apex: buildApex,
};
const example = (): unknown => JSON.parse(readFileSync(new URL('../levels/example.json', import.meta.url), 'utf8'));
const errorsOf = (value: unknown): string[] => {
  const r = parseLevelDoc(value);
  return r.ok ? [] : r.errors;
};
/** The example with one change made to it. */
const edited = (change: (doc: LevelDoc) => void): unknown => {
  const doc = example() as LevelDoc;
  change(doc);
  return doc;
};

for (const id of LEVEL_IDS) {
  test(`level format: ${id} written as a document builds the identical level`, () => {
    const doc = docFromBuilder(BUILT_IN[id]);
    assert.equal(doc.format, LEVEL_FORMAT);
    assert.equal(doc.meta.id, id);
    // Through text and back, as it would be from a file.
    const text = formatDoc(doc);
    const parsed = parseLevelDoc(JSON.parse(text));
    assert.ok(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n'));
    assert.deepEqual(parsed.warnings, []);
    assert.deepEqual(parsed.doc, JSON.parse(JSON.stringify(doc)), 'the layout of the file loses nothing');

    const original = getLevel(id);
    const rebuilt = levelFromDoc(parsed.doc);
    assert.equal(levelSignature(rebuilt), levelSignature(original));
    assert.deepEqual(rebuilt.objs, original.objs);
    assert.deepEqual(rebuilt.pits, original.pits);
    assert.deepEqual(rebuilt.segs, original.segs);
    assert.deepEqual(rebuilt.triggers, original.triggers);
    assert.deepEqual(rebuilt.meta, original.meta);
    assert.equal(rebuilt.endBeat, original.endBeat);
    // So the stored reference run clears it exactly as it clears the original.
    const run = replay(rebuilt, REPLAYS[id]);
    assert.ok(run.won);
    assert.equal(run.shards, 7);
    assert.ok(text.split('\n').every((l) => l.length < 260), 'one step to a line');
  });
}

test('level format: every method of the builder has a step, and every step a method', () => {
  const internal = ['constructor', 'x', 'end', 'build', 'push', 'spikeRow'];
  const methods = Object.getOwnPropertyNames(LevelBuilder.prototype).filter((m) => !internal.includes(m)).sort();
  const steps = Object.keys(OPS).filter((o) => o !== 'note').sort();
  assert.deepEqual(steps, methods);
  for (const [name, info] of Object.entries(OPS)) {
    assert.ok(info.about.length > 8, name);
    const firstOptional = info.params.findIndex((q) => q.optional);
    if (firstOptional >= 0) assert.ok(info.params.slice(firstOptional).every((q) => q.optional), `${name}: optional arguments come last`);
    if (name !== 'note') {
      const arity = (LevelBuilder.prototype as unknown as Record<string, (...a: unknown[]) => unknown>)[name].length;
      assert.ok(info.params.length >= arity, `${name}: the builder takes at least ${arity} arguments`);
    }
  }
});

test('level format: the example document is valid and passes the same checks as a shipped track', () => {
  const parsed = parseLevelDoc(example());
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n'));
  const level = levelFromDoc(parsed.doc);
  assert.equal(level.meta.id, 'example');
  assert.equal(level.meta.index, -1);
  assert.equal(level.shards.length, 3);
  const report = checkLevel(level, { song: getSong(parsed.doc.meta.song) });
  assert.deepEqual(report.problems, []);
  assert.ok(report.ok && report.toggles);
  assert.equal(report.notes.length, 1, 'only the note that the song is longer than the track');
  assert.equal(loadLevel(example()).endBeat, 32);
});

test('level format: mistakes are named with their place in the file and a suggestion', () => {
  assert.match(errorsOf('nope')[0], /must hold one object/);
  assert.match(errorsOf({})[0], /format: expected 1/);
  assert.match(errorsOf(edited((d) => { d.format = 2; }))[0], /format: expected 1, found 2/);

  const has = (value: unknown, about: RegExp): void => {
    const errors = errorsOf(value);
    assert.ok(errors.some((e) => about.test(e)), `${about} not in:\n${errors.join('\n')}`);
  };
  has(edited((d) => { d.steps[2] = { op: 'spike', beat: 4.5 }; }), /steps\[2\]: there is no step called "spike"\. Did you mean "spikes"\?/);
  has(edited((d) => { d.steps[2] = { op: 'spikes', beat: '4.5' }; }), /steps\[2\] \(spikes\)\.beat: expected a number, found "4\.5"/);
  has(edited((d) => { d.steps[2] = { op: 'spikes' }; }), /steps\[2\] \(spikes\): "beat" is missing/);
  has(edited((d) => { d.steps[2] = { op: 'spikes', beat: 4.5, count: 2 }; }), /steps\[2\] \(spikes\)\.count: "spikes" takes beat, n, y, small/);
  has(edited((d) => { d.steps[2] = { op: 'spikes', beat: 4.5, n: 1.5 }; }), /expected a whole number, found 1\.5/);
  has(edited((d) => { d.steps[2] = { op: 'spikes', beat: 4.5, small: 1 }; }), /expected true or false, found 1/);
  has(edited((d) => { d.steps[4] = { op: 'block', b0: 9, b1: 8, y0: 0, y1: 1 }; }), /b1 \(8\) must come after b0 \(9\)/);
  has(edited((d) => { d.steps.push({ op: 'gate', beat: 30, kind: 'shipp' }); }), /expected one of cube, ship, wave, flip, unflip, mini, big; found "shipp"\. Did you mean "ship"\?/);
  has(edited((d) => { d.steps.push({ op: 'gate', beat: 30, kind: 'speed' }); }), /expected one of cube, ship/);
  has(edited((d) => { d.steps.push({ op: 'saw', beat: 30, y: 2, move: { dx: 1, perod: 2 } }); }), /move\.perod: not part of a saw's travel\. Did you mean "period"\?/);
  has(edited((d) => { d.steps.push({ op: 'theme', beat: 30, theme: 2 }); }), /theme: 2 is past the last colour set \(1\)/);
  has(edited((d) => { d.steps.push({ op: 'dual', beat: 30, mirror: 4 }); }), /dual mode is never ended/);
  has(edited((d) => { d.steps.push({ op: 'solo', beat: 30, mirror: 4 }); }), /no dual gate before it/);
  has(edited((d) => { d.steps.push({ op: 'shard', beat: 30, y: 2 }); }), /exactly 3 shards; this one has 4/);
  has(edited((d) => { d.steps = d.steps.filter((s) => s.op !== 'shard'); }), /exactly 3 shards; this one has 0/);
  has(edited((d) => { d.speeds = [[16, 1.2], [8, 1]]; }), /speeds\[1\]: beat 8 must come after the change before it \(beat 16\)/);
  has(edited((d) => { (d.meta as unknown as Record<string, unknown>).dificulty = 'Easy'; }), /meta\.dificulty: not part of a level's description\. Did you mean "difficulty"\?/);
  has(edited((d) => { d.meta.themes[0].accent = 'cyan'; }), /meta\.themes\[0\]\.accent: expected a colour such as "#00e5ff", found "cyan"/);
  has(edited((d) => { d.meta.id = 'My Level'; }), /meta\.id: "My Level" must be lower-case/);
  has(edited((d) => { d.meta.bpm = 20; }), /meta\.bpm: 20 is below/);
  has(edited((d) => { (d as unknown as Record<string, unknown>).stpes = []; }), /stpes: not part of a level\. Did you mean "steps"\?/);
  has(edited((d) => { d.steps[2] = { op: 'constructor', beat: 1 }; }), /no step called "constructor"/);
  has(edited((d) => { d.end = 0; }), /end: expected the beat the track is won at/);

  // All of them at once are all reported, not only the first.
  const many = errorsOf(edited((d) => { d.steps[2] = { op: 'spike' }; d.steps[3] = { op: 'spikes' }; d.meta.bpm = 20; }));
  assert.equal(many.length, 3);
  assert.throws(() => loadLevel(edited((d) => { d.end = 0; })), /Not a valid level:\n {2}end:/);

  // Something past the end is worth a remark but is not wrong.
  const late = parseLevelDoc(edited((d) => { d.steps.push({ op: 'spikes', beat: 40 }); }));
  assert.ok(late.ok);
  assert.match(late.warnings[0], /beat 40 is after the end of the track \(beat 32\)/);
});

test('level format: the checks tell an impossible track from one with an unreachable shard', () => {
  const song = getSong('genesis');
  const wall = loadLevel(edited((d) => { d.steps.push({ op: 'spikes', beat: 24.5, n: 14 }); }));
  const blocked = checkLevel(wall, { song, maxNodes: 300_000 });
  assert.equal(blocked.ok, false);
  assert.match(blocked.problems[0], /No run clears the track .* beat 2[0-9]\.\d of 32/);

  const high = loadLevel(edited((d) => { for (const s of d.steps) if (s.op === 'shard' && s.beat === 20) s.y = 9.5; }));
  const shard = checkLevel(high, { song, maxNodes: 300_000 });
  assert.equal(shard.ok, false);
  assert.match(shard.problems[0], /can be cleared, but not with all three shards.*look at shard 2 \(beat 20\.0\)/);

  const empty = loadLevel(edited((d) => { d.steps = d.steps.filter((s) => s.op === 'shard').map((s) => ({ ...s, y: 0.5 })); }));
  assert.match(checkLevel(empty, { song }).problems.join(' '), /never presses anything reaches the end/);

  const slow = checkLevel(loadLevel(edited((d) => { d.meta.bpm = 100; })), { song });
  assert.match(slow.problems.join(' '), /100 BPM but its song "genesis" is at 124/);
  assert.match(checkLevel(loadLevel(example()), { song: null }).problems.join(' '), /no song called "genesis"/);
});

test('play-test: a document is played under its own id and leaves the save alone', () => {
  const bad = loadPlaytest(edited((d) => { d.steps[2] = { op: 'spike' }; }));
  assert.equal(bad.ok, false);
  const noSong = loadPlaytest(edited((d) => { d.meta.song = 'nothing'; }));
  assert.ok(!noSong.ok && /no song called "nothing"/.test(noSong.errors[0]));

  const loaded = loadPlaytest(example());
  assert.ok(loaded.ok);
  assert.equal(loaded.level.meta.id, PLAYTEST_ID);
  assert.equal(loaded.level.meta.name, 'Example');
  assert.equal(getLevel(PLAYTEST_ID), loaded.level);
  assert.deepEqual(referenceReplay(PLAYTEST_ID), loaded.report.toggles);
  assert.equal((LEVEL_IDS as readonly string[]).includes(PLAYTEST_ID), false);

  const data = new Map<string, string>();
  const store = new ProfileStore({ getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
  const before = JSON.stringify(store.profile);
  store.beginAttempt(PLAYTEST_ID, false);
  const out = store.recordRun({
    levelId: PLAYTEST_ID, practice: false, completed: true, died: false, progress: 1, seconds: 15, jumps: 9, orbs: 1, pads: 1,
    actions: 10, synced: 8, bestStreak: 5, shards: 7, sessionAttempts: 1,
  });
  assert.deepEqual([out.newBest, out.firstCompletion, out.newShards, out.unlockedLevel, out.achievements.length], [false, false, 0, null, 0]);
  assert.equal(JSON.stringify(store.profile), before);
});
