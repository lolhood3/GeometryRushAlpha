import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLevel } from '../src/game/levels/index.ts';
import { REPLAYS } from '../src/game/levels/replays.ts';
import { CELLS_PER_BEAT, HALF, JUMP_H } from '../src/game/sim/constants.ts';
import { Sim } from '../src/game/sim/sim.ts';

function run(sim: Sim, toggles: number[], untilTick: number): void {
  let i = 0;
  let held = sim.held;
  while (i < toggles.length && toggles[i] < sim.tick) { held = !held; i++; }
  while (!sim.dead && !sim.won && sim.tick < untilTick) {
    while (i < toggles.length && toggles[i] <= sim.tick) { held = !held; i++; }
    sim.setInput(held);
    sim.step();
  }
}

test('a jump lasts one beat, peaks at JUMP_H and travels one beat of cells', () => {
  const sim = new Sim(getLevel('genesis'));
  const tpb = Math.round(1 / sim.dB);
  sim.setInput(true);
  sim.step();
  sim.setInput(false);
  const x0 = sim.px;
  let peak = 0;
  let ticks = 1;
  while (!sim.grounded) { sim.step(); ticks++; peak = Math.max(peak, sim.y - HALF); }
  assert.ok(Math.abs(peak - JUMP_H) < 0.01, `peak ${peak}`);
  assert.ok(Math.abs(ticks - tpb) <= 2, `airtime ${ticks} ticks vs ${tpb}`);
  assert.ok(Math.abs(sim.x - x0 - CELLS_PER_BEAT) < 0.1);
});

test('simulation is deterministic', () => {
  const level = getLevel('overdrive');
  const a = new Sim(level);
  const b = new Sim(level);
  run(a, REPLAYS.overdrive, 20000);
  run(b, REPLAYS.overdrive, 20000);
  assert.equal(a.tick, b.tick);
  assert.equal(a.y, b.y);
  assert.equal(a.rot, b.rot);
  assert.equal(a.shards, b.shards);
});

test('snapshots restore the exact state (practice checkpoints)', () => {
  const level = getLevel('quantum');
  const a = new Sim(level);
  run(a, REPLAYS.quantum, 9000);
  const snap = a.save();
  run(a, REPLAYS.quantum, 16000);
  const b = new Sim(level);
  b.load(snap);
  run(b, REPLAYS.quantum, 16000);
  assert.equal(a.x, b.x);
  assert.equal(a.y, b.y);
  assert.equal(a.vy, b.vy);
  assert.equal(a.mode, b.mode);
  assert.equal(a.grav, b.grav);
  assert.equal(a.dead, b.dead);
});

test('reset returns to a clean attempt', () => {
  const sim = new Sim(getLevel('velocity'));
  run(sim, REPLAYS.velocity, 5000);
  sim.reset();
  assert.equal(sim.tick, 0);
  assert.equal(sim.x, 0);
  assert.equal(sim.shards, 0);
  assert.equal(sim.jumps, 0);
  assert.ok(sim.used.every((v) => v === 0));
});
