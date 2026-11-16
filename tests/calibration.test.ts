import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OFFSET_MAX, OFFSET_MIN, TAPS_NEEDED, TAPS_WARMUP, measureTaps, tapError } from '../src/game/calibration.ts';
import { getSong } from '../src/game/music/songs.ts';
import { ProfileStore } from '../src/game/progression/store.ts';

const song = getSong('metronome');
const BEAT = 60 / song.bpm;
const PERIOD = BEAT * 1000;

/** Small repeatable generator, so the made-up players tap the same way every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    return ((s ^ (s >>> 13)) >>> 0) / 4294967296;
  };
}
/** Roughly bell-shaped noise in ms with the given standard deviation. */
const noise = (r: () => number, sd: number): number => (r() + r() + r() + r() - 2) * sd * Math.sqrt(3);

/**
 * A player tapping along to clicks they hear `delay` ms late. Returns what the
 * calibrator records: the error of each tap from the nearest click.
 */
function player(delay: number, sd: number, seed: number, taps = TAPS_NEEDED): number[] {
  const r = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < taps; i++) {
    // The first taps are rough, as they are for real.
    const wobble = i < TAPS_WARMUP ? noise(r, 90) : noise(r, sd);
    out.push(tapError((2 + i) * BEAT + (delay + wobble) / 1000, BEAT));
  }
  return out;
}

test('calibration: the click track leaves room for every offset the setting allows', () => {
  assert.ok(PERIOD >= OFFSET_MAX - OFFSET_MIN + 40, `a ${PERIOD} ms pulse cannot tell ${OFFSET_MIN} from ${OFFSET_MAX}`);
  assert.equal(song.sections.reduce((n, s) => n + s.bars, 0), 1);
});

test('calibration: a tap is measured from the nearest click', () => {
  assert.ok(Math.abs(tapError(BEAT * 4 + 0.03, BEAT) - 30) < 1e-6);
  assert.ok(Math.abs(tapError(BEAT * 4 - 0.03, BEAT) + 30) < 1e-6);
  assert.ok(Math.abs(Math.abs(tapError(BEAT * 4.5, BEAT)) - PERIOD / 2) < 1e-6);
});

test('calibration: delays across the whole range are measured, wireless ones included', () => {
  for (const delay of [-120, -40, 0, 35, 120, 180, 240, 280, 320, 380]) {
    for (let seed = 1; seed <= 20; seed++) {
      const m = measureTaps(player(delay, 14, seed * 7 + delay), PERIOD);
      assert.ok(m, 'measured');
      assert.ok(Math.abs(m.offsetMs - delay) <= 15, `delay ${delay}, player ${seed}: measured ${m.offsetMs}`);
      assert.equal(m.clamped, false);
      assert.notEqual(m.quality, 'loose', `delay ${delay}, player ${seed}: spread ${m.spreadMs}`);
    }
  }
});

test('calibration: a delay of 280 ms is not mistaken for tapping early', () => {
  // Read from the nearest click on a 500 ms pulse, as it used to be, this comes out as -220.
  const m = measureTaps(player(280, 12, 99), PERIOD)!;
  assert.ok(Math.abs(m.offsetMs - 280) <= 12, String(m.offsetMs));
  // A cluster lying right across the wrap (half a pulse away) stays in one piece.
  const edge = measureTaps(player(PERIOD / 2, 15, 5), PERIOD)!;
  assert.ok(Math.abs(edge.offsetMs - PERIOD / 2) <= 15, String(edge.offsetMs));
  assert.ok(edge.spreadMs < 30, `spread ${edge.spreadMs}`);
});

test('calibration: slips are set aside rather than averaged in', () => {
  const taps = player(150, 10, 3);
  taps[5] = tapError(7 * BEAT + 0.15 + 0.21, BEAT);   // a late stab
  taps[9] = tapError(11 * BEAT + 0.15 - 0.19, BEAT);  // an early one
  const m = measureTaps(taps, PERIOD)!;
  assert.equal(m.dropped, 2);
  assert.equal(m.used, TAPS_NEEDED - TAPS_WARMUP - 2);
  assert.ok(Math.abs(m.offsetMs - 150) <= 10, String(m.offsetMs));
  assert.notEqual(m.quality, 'loose');
  assert.ok(m.spreadMs < 20);
});

test('calibration: scattered tapping is called loose, steady tapping steady', () => {
  let steady = 0;
  for (let seed = 1; seed <= 20; seed++) if (measureTaps(player(60, 8, seed), PERIOD)!.quality === 'steady') steady++;
  assert.ok(steady >= 18, `${steady} of 20 steady players were called steady`);

  const r = rng(11);
  const random = Array.from({ length: TAPS_NEEDED }, () => (r() - 0.5) * PERIOD);
  assert.equal(measureTaps(random, PERIOD)!.quality, 'loose');
  let loose = 0;
  for (let seed = 1; seed <= 20; seed++) if (measureTaps(player(60, 70, seed), PERIOD)!.quality === 'loose') loose++;
  assert.ok(loose >= 17, `${loose} of 20 scattered players were called loose`);
});

test('calibration: too few taps give no answer, and the answer stays inside the setting', () => {
  assert.equal(measureTaps([], PERIOD), null);
  assert.equal(measureTaps(player(50, 10, 1, TAPS_WARMUP + 2), PERIOD), null);
  assert.ok(measureTaps(player(50, 10, 1, TAPS_WARMUP + 3), PERIOD));
  assert.equal(measureTaps([1, 2, 3, 4, 5], 0), null);

  // 420 ms is readable on this pulse but past what the setting holds: say so, and stop at the limit.
  const far = measureTaps(player(420, 6, 2), PERIOD)!;
  assert.equal(far.offsetMs, OFFSET_MAX);
  assert.equal(far.clamped, true);
  for (let d = -300; d <= 300; d += 7) {
    const m = measureTaps(Array.from({ length: TAPS_NEEDED }, () => d), PERIOD)!;
    assert.ok(m.offsetMs >= OFFSET_MIN && m.offsetMs <= OFFSET_MAX);
    assert.ok(Number.isInteger(m.offsetMs));
  }
});

test('calibration: the save accepts the wider offset and still refuses nonsense', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  const a = new ProfileStore(storage);
  a.updateSettings({ audioOffsetMs: 320 });
  a.flush();
  assert.equal(new ProfileStore(storage).profile.settings.audioOffsetMs, 320);
  a.updateSettings({ audioOffsetMs: 9000 });
  a.flush();
  assert.equal(new ProfileStore(storage).profile.settings.audioOffsetMs, OFFSET_MAX);
  a.updateSettings({ audioOffsetMs: -9000 });
  a.flush();
  assert.equal(new ProfileStore(storage).profile.settings.audioOffsetMs, OFFSET_MIN);
});
