/**
 * Working out the audio offset from taps made along to a click track.
 *
 * Each tap is described by how far it fell from the nearest click. That number
 * wraps: on a 600 ms pulse a tap 350 ms late looks exactly like one 250 ms
 * early. Wireless audio is routinely that late, so the taps are treated as
 * points on a circle, gathered around wherever they cluster, and only then
 * read as a delay inside the range the setting allows.
 */

/** Limits of the sync offset setting, in milliseconds. */
export const OFFSET_MIN = -150;
export const OFFSET_MAX = 400;

/** Taps wanted for a measurement, and how many of the first are thrown away while the player finds the pulse. */
export const TAPS_NEEDED = 14;
export const TAPS_WARMUP = 2;

export type TapQuality = 'steady' | 'fair' | 'loose';

export interface TapMeasure {
  /** The offset to use, rounded and held inside the setting's limits. */
  offsetMs: number;
  /** The same before rounding and limiting. */
  rawMs: number;
  /** True when the measured delay is outside what the setting can hold. */
  clamped: boolean;
  /** Typical distance of a tap from the result, in ms (a robust standard deviation). */
  spreadMs: number;
  /** Taps the result rests on, and taps set aside as slips. */
  used: number;
  dropped: number;
  quality: TapQuality;
}

const wrap = (v: number, period: number): number => v - period * Math.round(v / period);

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/** How far a tap at song position `seconds` is from the nearest click, in ms: negative is early. */
export function tapError(seconds: number, beatSeconds: number): number {
  return wrap(seconds, beatSeconds) * 1000;
}

/**
 * The offset a set of tap errors points to, or null while there are too few
 * to say (fewer than three after the warm-up taps).
 */
export function measureTaps(
  errorsMs: readonly number[], periodMs: number, warmup = TAPS_WARMUP,
): TapMeasure | null {
  const taps = errorsMs.slice(warmup).filter((v) => Number.isFinite(v));
  if (taps.length < 3 || !(periodMs > 0)) return null;

  // Where on the circle the taps gather.
  let sx = 0;
  let sy = 0;
  for (const e of taps) {
    const a = (e / periodMs) * Math.PI * 2;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  const centre = (Math.atan2(sy, sx) / (Math.PI * 2)) * periodMs;
  const gathered = Math.hypot(sx, sy) / taps.length;

  // Read every tap relative to that, so a cluster lying across the wrap stays in one piece.
  const around = taps.map((e) => centre + wrap(e - centre, periodMs)).sort((a, b) => a - b);
  const mid = median(around);
  const mad = median(around.map((v) => Math.abs(v - mid)).sort((a, b) => a - b));
  // A slip is a tap far from the rest: a finger that landed twice, or a click that was missed.
  const limit = Math.max(60, 3 * 1.4826 * mad);
  const kept = around.filter((v) => Math.abs(v - mid) <= limit);
  const centreKept = median(kept);
  const spread = 1.4826 * median(kept.map((v) => Math.abs(v - centreKept)).sort((a, b) => a - b));

  // The delay is whichever reading of the cluster lies in the range the setting covers.
  const low = (OFFSET_MIN + OFFSET_MAX - periodMs) / 2;
  let raw = centreKept;
  while (raw < low) raw += periodMs;
  while (raw >= low + periodMs) raw -= periodMs;

  const offsetMs = Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, Math.round(raw)));
  const dropped = taps.length - kept.length;
  const quality: TapQuality = gathered < 0.6 || dropped * 3 > taps.length || spread >= 40 ? 'loose'
    : spread >= 20 || dropped > 1 ? 'fair' : 'steady';
  return { offsetMs, rawMs: raw, clamped: Math.round(raw) !== offsetMs, spreadMs: spread, used: kept.length, dropped, quality };
}
