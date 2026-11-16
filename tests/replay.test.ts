import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDaily } from '../src/game/levels/daily.ts';
import { LEVEL_IDS, getLevel } from '../src/game/levels/index.ts';
import { REPLAYS } from '../src/game/levels/replays.ts';
import { CODE_PREFIX, checkCode, decodeRun, encodeRun, runRef, runSignature, verifyRun, type RunData } from '../src/game/replay/code.ts';

const runOf = (id: string, toggles: number[], ticks = 1_000_000): RunData => {
  const level = getLevel(id);
  return { ref: runRef(level), sig: runSignature(level), ticks, toggles };
};

for (const id of LEVEL_IDS) {
  test(`run code: the reference run on ${id} survives the round trip and verifies as a full clear`, () => {
    const run = runOf(id, REPLAYS[id]);
    const code = encodeRun(run);
    assert.ok(code.startsWith(CODE_PREFIX));
    assert.match(code, /^GR2\.[A-Za-z0-9_-]+$/, 'safe to paste into a chat or a link');
    const back = decodeRun(code);
    assert.ok(back.ok);
    assert.deepEqual(back.run, run);
    const res = verifyRun(back.run);
    assert.ok(res.ok);
    assert.equal(res.completed, true);
    assert.equal(res.ending, 'cleared');
    assert.equal(res.percent, 100);
    assert.equal(res.shards, 7);
    assert.equal(res.levelId, id);
    assert.ok(res.sync > 0.3 && res.sync <= 1);
    // About four characters for every three toggles, plus a short header.
    assert.ok(code.length < REPLAYS[id].length * 2.8 + 60, `${code.length} characters for ${REPLAYS[id].length} toggles`);
  });
}

test('run code: the result is what the inputs produce, whatever the sender did', () => {
  // A run that stops pressing half way crashes, and is reported as that crash.
  const half = REPLAYS.genesis.slice(0, 40);
  const crashed = checkCode(encodeRun(runOf('genesis', half)));
  assert.ok(crashed.ok);
  assert.equal(crashed.completed, false);
  assert.equal(crashed.ending, 'crashed');
  assert.ok(crashed.percent > 5 && crashed.percent < 99, `${crashed.percent}%`);
  assert.ok(crashed.ticks > half[half.length - 1]);

  // A run that was left before anything happened to it.
  const left = checkCode(encodeRun(runOf('genesis', REPLAYS.genesis.slice(0, 6), REPLAYS.genesis[5] + 10)));
  assert.ok(left.ok);
  assert.equal(left.ending, 'left');
  assert.equal(left.ticks, REPLAYS.genesis[5] + 10);

  // No inputs at all: an idle player.
  const idle = checkCode(encodeRun(runOf('genesis', [])));
  assert.ok(idle.ok);
  assert.equal(idle.completed, false);
  assert.equal(idle.jumps, 0);

  // Inputs for one track cannot be passed off as a run on another.
  const wrong = { ...runOf('genesis', REPLAYS.genesis), ref: 'velocity' };
  const res = checkCode(encodeRun(wrong));
  assert.equal(res.ok, false);
  assert.match((res as { reason: string }).reason, /different version of Velocity/);
  const moved = checkCode(encodeRun({ ...runOf('velocity', REPLAYS.genesis) }));
  assert.ok(moved.ok);
  assert.equal(moved.completed, false, 'the inputs of Genesis do not clear Velocity');
});

test('run code: damaged, cut short, edited or foreign text is refused with a reason', () => {
  const code = encodeRun(runOf('genesis', REPLAYS.genesis));
  const bad = (text: string, about: RegExp): void => {
    const r = checkCode(text);
    assert.equal(r.ok, false, text.slice(0, 30));
    assert.match((r as { reason: string }).reason, about);
  };
  bad('', /Paste a run code/);
  bad('hello there', /starts with GR2\./);
  bad(code.slice(0, -5), /damaged or incomplete/);
  bad(code.slice(0, 40), /damaged or incomplete/);
  bad(`${code}AAAA`, /damaged or incomplete/);
  bad(code.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), /damaged or incomplete/);
  bad(`${CODE_PREFIX}!!!!`, /damaged/);
  bad(`${CODE_PREFIX}${'A'.repeat(30_000)}`, /too long/);
  // One changed character anywhere is caught by the checksum.
  for (const at of [6, 20, 60, 120]) {
    const ch = code[at] === 'x' ? 'y' : 'x';
    bad(code.slice(0, at) + ch + code.slice(at + 1), /damaged or incomplete/);
  }
  bad(encodeRun({ ...runOf('genesis', []), ref: 'nowhere' }), /no track by that name/);
  bad(encodeRun({ ...runOf('genesis', []), ref: 'daily@soon' }), /which daily remix/);
  // Line breaks and spaces picked up when copying do no harm.
  const wrapped = checkCode(`  ${code.replace(/(.{40})/g, '$1\n')}  `);
  assert.ok(wrapped.ok);
  assert.equal(wrapped.completed, true);
});

test('run code: a daily remix is tied to its day', () => {
  const d = buildDaily('2026-11-16');
  const run: RunData = { ref: runRef(d.level, d.key), sig: runSignature(d.level), ticks: 1_000_000, toggles: d.replay };
  assert.equal(run.ref, 'daily@2026-11-16');
  const res = checkCode(encodeRun(run));
  assert.ok(res.ok);
  assert.equal(res.completed, true);
  assert.equal(res.day, '2026-11-16');
  // The same inputs claimed for another day do not match that day's remix.
  const other = checkCode(encodeRun({ ...run, ref: 'daily@2026-11-17' }));
  assert.equal(other.ok, false);
});
