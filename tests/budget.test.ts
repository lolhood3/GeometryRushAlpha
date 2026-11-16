import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EFFECT_SHARES, FrameAverage, Governor, RenderBudget, SLOW_FRAME_MS } from '../src/engine/budget.ts';
import { Particles } from '../src/engine/particles.ts';

const SCALES = [1, 0.85, 0.7, 0.58];
const VSYNC = 1000 / 60;

interface Trace { seconds: number; share: number; scale: number }

/**
 * Runs the budget against a made-up device for `seconds`. `cost` says how long
 * a frame takes at a given effect share and resolution scale; the display then
 * shows it on the next refresh it is ready for, as a real one does.
 */
function run(
  budget: RenderBudget, seconds: number, cost: (share: number, scale: number, t: number) => number,
  opts: { auto?: boolean; refresh?: number } = {},
): Trace[] {
  const refresh = opts.refresh ?? VSYNC;
  const out: Trace[] = [];
  let t = 0;
  let debt = 0;
  while (t < seconds) {
    const work = cost(budget.share, SCALES[budget.resolution.step], t);
    // A frame that overruns is shown a refresh late; averaged over a few frames that is what `work` asks for.
    debt += Math.max(work, refresh);
    const shown = Math.max(1, Math.floor(debt / refresh + 1e-9)) * refresh;
    debt -= shown;
    const dt = shown / 1000;
    budget.update(dt, opts.auto ?? false);
    t += dt;
    out.push({ seconds: t, share: budget.share, scale: SCALES[budget.resolution.step] });
  }
  return out;
}
const changes = (trace: Trace[], key: 'share' | 'scale'): number => {
  let n = 0;
  for (let i = 1; i < trace.length; i++) if (trace[i][key] !== trace[i - 1][key]) n++;
  return n;
};
const timeAt = (trace: Trace[], test: (s: Trace) => boolean): number => {
  let sum = 0;
  for (let i = 1; i < trace.length; i++) if (test(trace[i])) sum += trace[i].seconds - trace[i - 1].seconds;
  return sum / trace[trace.length - 1].seconds;
};
const last = (trace: Trace[]): Trace => trace[trace.length - 1];

test('budget: a device that keeps up is never touched', () => {
  const b = new RenderBudget(SCALES.length);
  const trace = run(b, 120, (share) => 6 + 5 * share, { auto: true });
  assert.equal(changes(trace, 'share'), 0);
  assert.equal(changes(trace, 'scale'), 0);
  assert.equal(last(trace).share, 1);
  // The same at 120 Hz, where frames are half as long as the budget.
  const fast = new RenderBudget(SCALES.length);
  assert.equal(changes(run(fast, 60, () => 5, { auto: true, refresh: 1000 / 120 }), 'share'), 0);
});

test('budget: effects are thinned within seconds when they are what costs, at any quality setting', () => {
  // 9 ms of everything else, 16 ms of effects at full: 25 ms a frame until some are dropped.
  const b = new RenderBudget(SCALES.length);
  const trace = run(b, 120, (share) => 9 + 16 * share);
  const firstCut = trace.find((s) => s.share < 1)!;
  assert.ok(firstCut.seconds < 2.5, `first cut after ${firstCut.seconds.toFixed(1)} s`);
  const settled = trace.filter((s) => s.seconds > 20);
  // 9 + 16 × 0.55 = 17.8 ms: one frame in fifteen late, which is let be. Full (25 ms) and 0.75 (21 ms) are not.
  assert.ok(timeAt(settled, (s) => s.share === 0.55) > 0.8, 'mostly at the largest share that fits');
  assert.ok(settled.every((s) => s.share >= 0.4), 'never cut further than needed');
  assert.equal(changes(trace, 'scale'), 0, 'resolution is not touched on a fixed quality setting');
  // It tries for more now and then, and each failed try makes it wait longer: no flapping.
  const tries = changes(trace.filter((s) => s.seconds > 20), 'share');
  assert.ok(tries <= 10, `${tries} changes in 100 s`);
});

test('budget: effects come back after a heavy moment passes', () => {
  const b = new RenderBudget(SCALES.length);
  const trace = run(b, 60, (share, _scale, t) => (t > 5 && t < 12 ? 10 + 22 * share : 6 + 6 * share));
  const during = trace.filter((s) => s.seconds > 9 && s.seconds < 12);
  assert.ok(during.every((s) => s.share <= 0.4), 'cut while it lasts');
  const back = trace.find((s) => s.seconds > 12 && s.share === 1);
  assert.ok(back && back.seconds < 12 + 22, `back to full at ${back?.seconds.toFixed(1)} s`);
  assert.equal(last(trace).share, 1);
  assert.equal(changes(trace.filter((s) => s.seconds > 35), 'share'), 0, 'and stays there');
});

test('budget: a display capped at 30 fps is recognised, not punished', () => {
  // Low-power mode: every frame takes 33 ms whatever is drawn.
  const b = new RenderBudget(SCALES.length);
  const trace = run(b, 600, () => 4, { auto: true, refresh: 1000 / 30 });
  assert.ok(trace.some((s) => s.share < 1), 'it does try cutting');
  assert.ok(b.effects.resigned && b.resolution.resigned, 'and learns that it does not help');
  assert.equal(last(trace).share, 1);
  assert.equal(last(trace).scale, 1);
  assert.ok(timeAt(trace, (s) => s.share === 1 && s.scale === 1) > 0.96, 'at full quality nearly all the time');
  const settled = trace.filter((s) => s.seconds > 60);
  assert.equal(changes(settled, 'share') + changes(settled, 'scale'), 0, 'and does not keep trying');

  // The cap is lifted and then the device really struggles: it acts again.
  const after = run(b, 30, () => 4, { auto: true });
  assert.ok(!b.effects.resigned);
  assert.equal(last(after).share, 1);
  const loaded = run(b, 30, (share) => 9 + 16 * share, { auto: true });
  assert.ok(last(loaded).share < 1);
});

test('budget: on Auto, resolution drops only after effects have given what they can, and recovers', () => {
  // Fill-rate bound: pixels cost 24 ms at full resolution, effects 3 ms.
  const cost = (share: number, scale: number, t: number): number => (t < 60 ? 3 * share + 24 * scale * scale : 3 * share + 9 * scale * scale);
  const b = new RenderBudget(SCALES.length);
  const trace = run(b, 400, cost, { auto: true });
  const firstScale = trace.find((s) => s.scale < 1)!;
  const before = trace.filter((s) => s.seconds < firstScale.seconds);
  assert.ok(before.some((s) => s.share === EFFECT_SHARES[EFFECT_SHARES.length - 1]), 'effects were taken to their least first');
  const heavy = trace.filter((s) => s.seconds > 40 && s.seconds < 60);
  assert.ok(heavy.every((s) => s.scale <= 0.85), 'resolution is down while the load lasts');
  // Once the load is gone both dials work their way back to full.
  assert.equal(last(trace).scale, 1);
  assert.equal(last(trace).share, 1);
  const up = trace.find((s) => s.seconds > 60 && s.scale === 1)!;
  assert.ok(up.seconds < 60 + 120, `full resolution again at ${up.seconds.toFixed(0)} s`);

  // On a fixed setting the same device keeps its resolution.
  const fixed = new RenderBudget(SCALES.length);
  assert.equal(changes(run(fixed, 120, cost), 'scale'), 0);
});

test('budget: a stalled tab or a single long frame changes nothing', () => {
  const avg = new FrameAverage();
  assert.equal(avg.push(0.25), false);
  assert.equal(avg.push(3), false);
  assert.equal(avg.push(0), false);
  assert.ok(Math.abs(avg.ms - VSYNC) < 1e-9);
  const b = new RenderBudget(SCALES.length);
  let worst = 0;
  for (let i = 0; i < 3000; i++) {
    // A 120 ms hitch every second and a half, a four-second stall now and then.
    b.update(i % 997 === 0 ? 4 : i % 97 === 0 ? 0.12 : VSYNC / 1000, true);
    worst = Math.max(worst, b.pace.ms);
  }
  assert.equal(b.share, 1);
  assert.equal(b.resolution.step, 0);
  assert.ok(worst < SLOW_FRAME_MS, `the average never read worse than ${worst.toFixed(1)} ms`);
});

test('budget: a step up that fails doubles the wait before the next one', () => {
  const g = new Governor({ steps: 3, slowFor: 0.5, settle: 0.5, patience: 2, maxPatience: 16 });
  // 15 ms at the lower positions, 24 ms at full.
  const ups: number[] = [];
  let t = 0;
  for (; t < 80; t += 1 / 60) {
    const before = g.step;
    g.update(g.step === 0 ? 24 : 15, 1 / 60);
    if (g.step < before) ups.push(t);
  }
  assert.ok(ups.length >= 4, `${ups.length} tries`);
  const gaps = ups.slice(1).map((v, i) => v - ups[i]);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] >= gaps[i - 1] - 0.1, `waits grow: ${gaps.map((v) => v.toFixed(1)).join(', ')}`);
  assert.ok(gaps[gaps.length - 1] <= 16 + 2, 'up to the longest wait and no further');
  g.reset();
  assert.equal(g.step, 0);
});

test('particles: the cap refuses decoration first and never the essential', () => {
  const p = new Particles(64);
  const one = { x: 0, y: 0, life: 1, size: 1, r: 1, g: 1, b: 1 };
  p.limit = 10;
  for (let i = 0; i < 40; i++) p.emit(one);
  assert.equal(p.count, 10);
  p.emit(one, true);
  p.emit(one, true);
  assert.equal(p.count, 12, 'essential particles are made over the limit');
  p.update(0.5);
  assert.equal(p.count, 12);
  p.update(0.6);
  assert.equal(p.count, 0);
  for (let i = 0; i < 40; i++) p.emit(one);
  assert.equal(p.count, 10, 'room again once the old ones are gone');
  p.limit = 64;
  for (let i = 0; i < 200; i++) p.emit(one);
  assert.equal(p.count, 64, 'never more than the pool holds');
  p.clear();
  assert.equal(p.count, 0);
});
