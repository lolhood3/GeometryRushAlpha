import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLevel } from '../src/game/levels/index.ts';
import { REPLAYS } from '../src/game/levels/replays.ts';
import { GHOST_KEY, GhostStore, betterGhost, levelSignature } from '../src/game/progression/ghosts.ts';
import { defaultProfile, sanitizeProfile } from '../src/game/progression/profile.ts';
import { BUFFER_BEATS, Ev, HALF, MINI_HALF, MINI_JUMP_H } from '../src/game/sim/constants.ts';
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
const ticksAt = (sim: Sim, beat: number): number => Math.round(beat / sim.dB);
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

/** Presses for one tick, then steps until the cube lands. Returns the airtime in ticks and the peak height of its underside. */
function hop(sim: Sim, half: number): { ticks: number; peak: number } {
  sim.setInput(true); sim.step(); sim.setInput(false);
  let ticks = 1;
  let peak = 0;
  while (!sim.grounded) { sim.step(); ticks++; peak = Math.max(peak, sim.y - half); }
  return { ticks, peak };
}

test('input buffer: a press just before landing jumps on landing, an earlier one is forgotten', () => {
  const landing = (() => {
    const s = new Sim(getLevel('genesis'));
    return hop(s, HALF).ticks;
  })();
  const window = ticksAt(new Sim(getLevel('genesis')), BUFFER_BEATS);
  assert.ok(window >= 10, `the window is ${window} ticks`);

  const press = (before: number): number => {
    const s = new Sim(getLevel('genesis'));
    s.setInput(true); s.step(); s.setInput(false);
    while (s.tick < landing - before) s.step();
    // A tap: down for two ticks, up again well before the cube lands.
    s.setInput(true); s.step(); s.step(); s.setInput(false);
    while (s.tick < landing + 6) s.step();
    return s.jumps;
  };
  assert.equal(press(Math.floor(window / 2)), 2, 'a tap inside the window is kept for the landing');
  assert.equal(press(window + 12), 1, 'a tap before the window is dropped');
});

test('mini: the cube is smaller and its jump lasts half a beat', () => {
  const level = getLevel('genesis');
  const big = hop(new Sim(level), HALF);
  const s = new Sim(level);
  s.mini = true;
  for (let i = 0; i < 30; i++) s.step();
  assert.ok(s.grounded, 'settles on the ground at its new size');
  assert.ok(Math.abs(s.y - MINI_HALF) < 0.02, `rests at ${s.y}`);
  const small = hop(s, MINI_HALF);
  assert.ok(Math.abs(small.peak - MINI_JUMP_H) < 0.02, `peak ${small.peak}`);
  assert.ok(Math.abs(small.ticks - big.ticks / 2) <= 2, `airtime ${small.ticks} ticks against ${big.ticks} at full size`);
});

test('mini: Overdrive shrinks the player for its passage and restores it after', () => {
  const s = new Sim(getLevel('overdrive'));
  run(s, REPLAYS.overdrive, ticksAt(s, 63));
  assert.equal(s.mini, false);
  run(s, REPLAYS.overdrive, ticksAt(s, 67));
  assert.equal(s.dead, false);
  assert.equal(s.mini, true);
  run(s, REPLAYS.overdrive, ticksAt(s, 73));
  assert.equal(s.mini, false);
});

test('dual: Quantum runs a twin under opposite gravity, then lets it go', () => {
  const s = new Sim(getLevel('quantum'));
  run(s, REPLAYS.quantum, ticksAt(s, 81));
  assert.equal(s.dual, false);
  run(s, REPLAYS.quantum, ticksAt(s, 88));
  assert.equal(s.dead, false);
  assert.equal(s.dual, true);
  assert.equal(s.tgrav, -s.grav, 'the twin falls the other way');
  assert.ok(Math.abs(s.ty - s.y) > 1, `twin at ${s.ty}, player at ${s.y}`);
  run(s, REPLAYS.quantum, ticksAt(s, 96));
  assert.equal(s.dead, false);
  assert.equal(s.dual, false);
});

test('a snapshot taken in dual restores the twin exactly', () => {
  const a = new Sim(getLevel('quantum'));
  run(a, REPLAYS.quantum, ticksAt(a, 87));
  const snap = a.save();
  run(a, REPLAYS.quantum, ticksAt(a, 92));
  const first = { x: a.x, y: a.y, ty: a.ty, tvy: a.tvy, dual: a.dual, tick: a.tick, shards: a.shards };
  a.load(snap);
  assert.equal(a.dual, true);
  run(a, REPLAYS.quantum, ticksAt(a, 92));
  assert.deepEqual({ x: a.x, y: a.y, ty: a.ty, tvy: a.tvy, dual: a.dual, tick: a.tick, shards: a.shards }, first);
});

test('timing: every timed action reports how far off the beat it was, at most a sixteenth', () => {
  const s = new Sim(getLevel('genesis'));
  s.emit = true;
  const offs: number[] = [];
  let i = 0;
  let held = false;
  const t = REPLAYS.genesis;
  while (!s.dead && !s.won) {
    while (i < t.length && t[i] <= s.tick) { held = !held; i++; }
    s.setInput(held);
    s.step();
    for (const e of s.events) if (e.type === Ev.Jump || e.type === Ev.Orb) offs.push(e.off);
    s.events.length = 0;
  }
  assert.ok(s.won);
  assert.ok(offs.length > 20, `${offs.length} timed actions`);
  assert.ok(offs.every((o) => Math.abs(o) <= 0.2501), `largest ${Math.max(...offs.map(Math.abs))}`);
});

test('ghost: the signature follows the level, and a ghost is only given back for its own level', () => {
  const genesis = getLevel('genesis');
  const velocity = getLevel('velocity');
  assert.equal(levelSignature(genesis), levelSignature(getLevel('genesis')));
  assert.notEqual(levelSignature(genesis).split(':').slice(1).join(':'), levelSignature(velocity).split(':').slice(1).join(':'));

  const mem = memory();
  const store = new GhostStore(mem);
  assert.equal(store.get(genesis), null);
  assert.equal(store.offer(genesis, { percent: 40, completed: false, sync: 0.5, ticks: 3000, toggles: [10, 20, 400, 420] }), true);
  assert.equal(store.offer(genesis, { percent: 30, completed: false, sync: 0.9, ticks: 2000, toggles: [10, 20] }), false, 'a shorter run does not replace it');
  assert.deepEqual(store.get(genesis)?.toggles, [10, 20, 400, 420]);
  assert.equal(store.get(velocity), null);

  // Survives a reload, and a changed level no longer matches.
  const again = new GhostStore(mem);
  assert.deepEqual(again.get(genesis)?.toggles, [10, 20, 400, 420]);
  const changed = { ...genesis, endBeat: genesis.endBeat + 1 };
  assert.equal(again.get(changed), null);

  // Damaged storage is ignored rather than trusted.
  mem.setItem(GHOST_KEY, '{"ghosts":{"genesis":{"sig":1,"t":"x"}}}');
  assert.equal(new GhostStore(mem).get(genesis), null);
  again.clear();
  assert.equal(new GhostStore(mem).get(genesis), null);
});

test('ghost: a clear beats any crash, tighter sync beats a looser clear, further beats nearer', () => {
  const crash = (percent: number) => ({ percent, completed: false, sync: 0.5 });
  const clear = (sync: number) => ({ percent: 100, completed: true, sync });
  assert.equal(betterGhost(crash(10), null), true);
  assert.equal(betterGhost(crash(60), crash(40)), true);
  assert.equal(betterGhost(crash(40), crash(40)), false);
  assert.equal(betterGhost(clear(0.2), crash(99)), true);
  assert.equal(betterGhost(crash(99), clear(0.2)), false);
  assert.equal(betterGhost(clear(0.8), clear(0.7)), true);
  assert.equal(betterGhost(clear(0.7), clear(0.8)), false);
});

test('settings: the timing cue is on by default and survives a save', () => {
  const d = defaultProfile();
  assert.equal(d.settings.showTiming, true);
  const off = sanitizeProfile({ version: 2, settings: { showTiming: false } });
  assert.equal(off.settings.showTiming, false);
  const junk = sanitizeProfile({ version: 2, settings: { showTiming: 3 } });
  assert.equal(junk.settings.showTiming, true);
});

test('settings: the best run is no longer shown during play, so there is no setting for it', () => {
  assert.equal('ghost' in defaultProfile().settings, false);
  // A save written while the setting existed loads as usual; the old switch is simply dropped.
  const old = sanitizeProfile({ version: 2, settings: { ghost: false, showTiming: false } });
  assert.equal('ghost' in old.settings, false);
  assert.equal(old.settings.showTiming, false);
});
