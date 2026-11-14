import assert from 'node:assert/strict';
import { test } from 'node:test';
import { replay, solve } from '../src/game/dev/solver.ts';
import { VERIFY } from '../src/game/dev/verify.ts';
import { LEVEL_IDS, getLevel } from '../src/game/levels/index.ts';
import { REPLAYS } from '../src/game/levels/replays.ts';
import { beatAtX, xAtBeat } from '../src/game/sim/level.ts';

for (const id of LEVEL_IDS) {
  test(`${id}: beatable with all shards inside its timing budget`, () => {
    const level = getLevel(id);
    const r = solve(level, { ...VERIFY[id], maxNodes: 3_000_000 });
    assert.ok(r.ok, `stuck at beat ${r.maxBeat.toFixed(1)} of ${level.endBeat}: ${r.death}`);
    const run = replay(level, r.toggles);
    assert.ok(run.won);
    assert.equal(run.shards, 7);
  });

  test(`${id}: stored autopilot replay still wins`, () => {
    const run = replay(getLevel(id), REPLAYS[id]);
    assert.ok(run.won, `replay died at beat ${run.beat.toFixed(1)}`);
    assert.equal(run.shards, 7);
  });

  test(`${id}: idle player dies (level is not trivially passable)`, () => {
    const run = replay(getLevel(id), []);
    assert.equal(run.won, false);
  });

  test(`${id}: beat/x mapping round-trips across speed gates`, () => {
    const level = getLevel(id);
    for (let b = 0; b <= level.endBeat; b += 3.7) {
      assert.ok(Math.abs(beatAtX(level, xAtBeat(level, b)) - b) < 1e-9);
    }
    assert.ok(Math.abs(xAtBeat(level, level.endBeat) - level.endX) < 1e-9);
  });
}

import { songBeats } from '../src/engine/audio/music.ts';
import { getSong } from '../src/game/music/songs.ts';

for (const id of LEVEL_IDS) {
  test(`${id}: soundtrack ends exactly on the finish line`, () => {
    const level = getLevel(id);
    const song = getSong(level.meta.song);
    assert.equal(song.bpm, level.bpm);
    assert.equal(songBeats(song), level.endBeat);
  });
}
