import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVEL_IDS, getLevel } from '../src/game/levels/index.ts';
import { REPLAYS } from '../src/game/levels/replays.ts';
import { MODE_NAME, modeMix, previewWindow, routeOf, sectionAt, sectionStart, type RouteSection } from '../src/game/levels/route.ts';
import { getSong } from '../src/game/music/songs.ts';
import { TICK_RATE } from '../src/game/sim/constants.ts';
import { Sim } from '../src/game/sim/sim.ts';
import { ProfileStore, type RunReport } from '../src/game/progression/store.ts';

/** Plays the reference run on from the start of a part. */
function playFrom(id: string, part: RouteSection): Sim {
  const sim = new Sim(getLevel(id));
  sim.load(sectionStart(part));
  const toggles = REPLAYS[id];
  let idx = part.cursor.idx;
  let held = part.cursor.held;
  while (!sim.dead && !sim.won && sim.tick < 400000) {
    while (idx < toggles.length && toggles[idx] <= sim.tick) { held = !held; idx++; }
    sim.setInput(held);
    sim.step();
  }
  return sim;
}

test('route: parts cover each track from start to finish, in order, named after the song', () => {
  for (const id of LEVEL_IDS) {
    const level = getLevel(id);
    const route = routeOf(id);
    const parts = route.sections;
    assert.ok(parts.length >= 4, `${id} has parts`);
    assert.equal(parts[0].beat, 0, id);
    assert.equal(parts[0].start, 0, id);
    assert.equal(parts[parts.length - 1].endBeat, level.endBeat, id);
    assert.equal(parts[parts.length - 1].end, 1, id);
    const kinds = getSong(level.meta.song).sections.map((s) => s.name);
    parts.forEach((p, i) => {
      assert.equal(p.index, i);
      assert.equal(p.kind, kinds[i], `${id} part ${i} follows the song`);
      assert.ok(p.end > p.start, `${id} ${p.name} has length`);
      if (i > 0) {
        assert.equal(p.beat, parts[i - 1].endBeat, `${id} ${p.name} starts where the last one ends`);
        assert.equal(p.start, parts[i - 1].end, `${id} ${p.name} has no gap`);
      }
      assert.ok(p.modes.length > 0, `${id} ${p.name} lists its vehicles`);
    });
    assert.equal(new Set(parts.map((p) => p.name)).size, parts.length, `${id} part names are unique`);
  }
});

test('route: vehicle spans are back to back and the shares add up', () => {
  for (const id of LEVEL_IDS) {
    const route = routeOf(id);
    assert.equal(route.spans[0].start, 0, id);
    assert.equal(route.spans[route.spans.length - 1].end, 1, id);
    for (let i = 1; i < route.spans.length; i++) {
      assert.ok(Math.abs(route.spans[i].start - route.spans[i - 1].end) < 1e-9, `${id} span ${i} is contiguous`);
      const a = route.spans[i - 1];
      const b = route.spans[i];
      assert.ok(a.mode !== b.mode || a.flipped !== b.flipped, `${id} span ${i} differs from the one before`);
    }
    const mix = modeMix(route);
    assert.ok(Math.abs(mix.reduce((n, m) => n + m.share, 0) - 1) < 1e-9, `${id} shares sum to 1`);
    for (let i = 1; i < mix.length; i++) assert.ok(mix[i - 1].share >= mix[i].share, `${id} mix is sorted`);
    for (const m of mix) assert.equal(m.name, MODE_NAME[m.mode]);
    assert.ok(route.speed[0] <= route.speed[1]);
    assert.ok(route.hazards > 0, id);
  }
});

test('route: the breakdown agrees with what the levels are known to contain', () => {
  const names = (id: string) => modeMix(routeOf(id)).map((m) => m.name).sort();
  assert.deepEqual(names('genesis'), ['Cube']);
  assert.deepEqual(names('velocity'), ['Cube']);
  assert.deepEqual(names('overdrive'), ['Cube', 'Ship']);
  assert.deepEqual(names('quantum'), ['Cube', 'Ship', 'Wave']);
  assert.deepEqual(names('apex'), ['Cube', 'Ship', 'Wave']);
  assert.equal(routeOf('genesis').flips, 0);
  assert.ok(routeOf('overdrive').flips > 0, 'Overdrive has gravity pads');
  assert.deepEqual(routeOf('genesis').speed, [1, 1]);
  assert.ok(routeOf('velocity').speed[1] > 1, 'Velocity has speed gates');
});

test('route: every part can be started from and played to the end', () => {
  for (const id of LEVEL_IDS) {
    const level = getLevel(id);
    for (const part of routeOf(id).sections) {
      const snap = part.cursor.snap;
      const beat = (snap.tick / TICK_RATE) / level.beatDur;
      assert.equal(part.cursor.held, false, `${id} ${part.name} starts with the button up`);
      if (part.index === 0) assert.equal(snap.tick, new Sim(level).save().tick, `${id} first part is the very start`);
      else {
        assert.ok(beat <= part.beat + 0.01, `${id} ${part.name} starts no later than the part (${beat.toFixed(2)})`);
        assert.ok(beat >= part.beat - 6.01, `${id} ${part.name} starts within six beats of it (${beat.toFixed(2)})`);
      }
      const sim = playFrom(id, part);
      assert.equal(sim.won, true, `${id} can be finished from ${part.name}`);
    }
  }
});

test('route: a run from a part starts with clean counters and none of the shards before it', () => {
  for (const id of LEVEL_IDS) {
    const parts = routeOf(id).sections;
    const last = parts[parts.length - 1];
    assert.ok(last.cursor.snap.jumps > 0, `${id} reference run has jumped by then`);
    const start = sectionStart(last);
    for (const k of ['shards', 'jumps', 'actions', 'synced', 'streak', 'bestStreak', 'orbs', 'pads'] as const) assert.equal(start[k], 0, `${id} ${k}`);
    assert.equal(start.tick, last.cursor.snap.tick);
    assert.notEqual(start.used, last.cursor.snap.used, 'the snapshot is a copy');
  }
});

test('route: sectionAt finds the part for any position', () => {
  const route = routeOf('overdrive');
  assert.equal(sectionAt(route, 0).index, 0);
  assert.equal(sectionAt(route, -1).index, 0);
  assert.equal(sectionAt(route, 1).index, route.sections.length - 1);
  for (const p of route.sections) {
    assert.equal(sectionAt(route, p.start).index, p.index);
    assert.equal(sectionAt(route, (p.start + p.end) / 2).index, p.index);
  }
});

test('route: the level-select preview is the first drop, with its run-up', () => {
  for (const id of LEVEL_IDS) {
    const level = getLevel(id);
    const route = routeOf(id);
    const w = previewWindow(route);
    const part = route.sections[w.section];
    assert.equal(part.kind, 'drop', id);
    assert.ok(route.sections.slice(0, w.section).every((p) => p.kind !== 'drop'), `${id} previews its first drop`);
    assert.ok(w.from <= part.beat * level.beatDur + 0.01 && w.from >= 0, id);
    assert.ok(Math.abs(w.to - part.endBeat * level.beatDur) < 1e-9, id);
    assert.ok(w.to - w.from > 6 && w.to - w.from < 20, `${id} preview is a short loop (${(w.to - w.from).toFixed(1)} s)`);
    const bars = getSong(level.meta.song).sections.reduce((n, x) => n + x.bars, 0);
    assert.ok(w.to <= bars * 4 * level.beatDur + 1e-6, `${id} preview stays inside the song`);
  }
});

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}
const run = (over: Partial<RunReport>): RunReport => ({
  levelId: 'genesis', practice: true, completed: false, died: true, progress: 0.4, seconds: 20, jumps: 10, orbs: 0, pads: 0,
  actions: 10, synced: 5, bestStreak: 3, shards: 0, sessionAttempts: 1, ...over,
});

test('section practice: reaching the end from part-way is not a Practice clear and sets no best', () => {
  const store = new ProfileStore(memory());
  const out = store.recordRun(run({ completed: true, progress: 1, section: true }));
  const rec = store.profile.levels.genesis;
  assert.equal(rec.practiceCompleted, false);
  assert.equal(rec.practiceBest, 0);
  assert.equal(out.newBest, false);
  assert.equal(store.profile.levels.velocity.best, 0);
  assert.ok(!store.profile.achievements.rehearsal, 'no Rehearsal achievement');
  assert.equal(store.profile.totals.jumps, 10, 'the jumps still count');

  store.recordRun(run({ progress: 0.9, section: true }));
  assert.equal(store.profile.levels.genesis.practiceBest, 0);

  // The same run from the start counts as before.
  store.recordRun(run({ completed: true, progress: 1 }));
  assert.equal(store.profile.levels.genesis.practiceCompleted, true);
  assert.equal(store.profile.levels.genesis.practiceBest, 100);
  store.flush();
});
