import { isDateKey } from '../levels/calendar.ts';
import { buildDaily } from '../levels/daily.ts';
import { DAILY_ID, LEVEL_IDS, getLevel } from '../levels/index.ts';
import { levelSignature, MAX_GHOST_TOGGLES } from '../progression/ghosts.ts';
import { syncRank, type SyncRank } from '../progression/profile.ts';
import type { Level } from '../sim/level.ts';
import { DT } from '../sim/constants.ts';
import { Sim } from '../sim/sim.ts';

/**
 * Run codes: a run written down as text that can be passed to someone else.
 *
 * A code holds only what the player did (the ticks on which the button
 * changed) and which level it was done on. It makes no claim about the
 * result. Whoever receives it plays the inputs through the simulation again,
 * so the percentage, shards and sync shown for a code are always what those
 * inputs really produce and cannot be edited into the text.
 */

export const CODE_PREFIX = 'GR2.';
const FORMAT = 1;
/** Longest text accepted, to keep a pasted novel from being decoded. */
export const MAX_CODE_LENGTH = 24_000;

export interface RunData {
  /** `genesis`, or `daily@2026-11-16` for a daily remix. */
  ref: string;
  /** Fingerprint of the level and physics the run was recorded on. */
  sig: number;
  /** Length of the run in simulation ticks. */
  ticks: number;
  /** Ticks on which the button changed, starting from released. */
  toggles: number[];
}

export type Decoded = { ok: true; run: RunData } | { ok: false; reason: string };

export interface RunCheck {
  ok: true;
  run: RunData;
  level: Level;
  levelId: string;
  /** For a daily remix: the day it belongs to. */
  day: string | null;
  completed: boolean;
  /** How far the run got, 0..100. */
  percent: number;
  /** Shards held when the run ended, as a bit mask. */
  shards: number;
  sync: number;
  rank: SyncRank;
  bestStreak: number;
  jumps: number;
  /** Ticks actually simulated: where the run crashed, won or was left. */
  ticks: number;
  seconds: number;
  /** How the run ended. */
  ending: 'cleared' | 'crashed' | 'left';
}
export type Checked = RunCheck | { ok: false; reason: string };

// ── Bytes ──────────────────────────────────────────────────────────────────

function fnv(bytes: ArrayLike<number>, n = bytes.length): number {
  let h = 2166136261;
  for (let i = 0; i < n; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const hashText = (s: string): number => fnv(Array.from(s, (c) => c.charCodeAt(0) & 0xff));

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += ALPHABET[a >> 2] + ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += ALPHABET[c & 63];
  }
  return out;
}

function fromBase64Url(text: string): number[] | null {
  if (text.length % 4 === 1) return null;
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  return out;
}

function pushVarint(out: number[], n: number): void {
  let v = n;
  while (v >= 0x80) { out.push((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
  out.push(v);
}

// ── Encode / decode ────────────────────────────────────────────────────────

/** The level reference a run on `level` is stored under. A daily remix needs its day. */
export function runRef(level: Level, day: string | null = null): string {
  return level.meta.id === DAILY_ID ? `${DAILY_ID}@${day ?? ''}` : level.meta.id;
}

export const runSignature = (level: Level): number => hashText(levelSignature(level));

export function encodeRun(run: RunData): string {
  const bytes: number[] = [FORMAT, run.ref.length];
  for (const ch of run.ref) bytes.push(ch.charCodeAt(0) & 0x7f);
  bytes.push(run.sig >>> 24, (run.sig >>> 16) & 0xff, (run.sig >>> 8) & 0xff, run.sig & 0xff);
  pushVarint(bytes, run.ticks);
  pushVarint(bytes, run.toggles.length);
  let prev = 0;
  for (const t of run.toggles) { pushVarint(bytes, t - prev); prev = t; }
  const sum = fnv(bytes);
  bytes.push(sum >>> 24, (sum >>> 16) & 0xff, (sum >>> 8) & 0xff, sum & 0xff);
  return CODE_PREFIX + toBase64Url(bytes);
}

/** Reads a code back. Spaces and line breaks picked up on the way are ignored. */
export function decodeRun(input: string): Decoded {
  const fail = (reason: string): Decoded => ({ ok: false, reason });
  if (typeof input !== 'string') return fail('That is not a run code.');
  if (input.length > MAX_CODE_LENGTH * 2) return fail('That is too long to be a run code.');
  const text = input.replace(/\s+/g, '');
  if (text === '') return fail('Paste a run code to check it.');
  if (text.length > MAX_CODE_LENGTH) return fail('That is too long to be a run code.');
  if (!text.startsWith(CODE_PREFIX)) return fail(`A run code starts with ${CODE_PREFIX}`);
  const bytes = fromBase64Url(text.slice(CODE_PREFIX.length));
  if (!bytes || bytes.length < 12) return fail('The code is damaged or incomplete.');

  const body = bytes.length - 4;
  const sum = ((bytes[body] << 24) | (bytes[body + 1] << 16) | (bytes[body + 2] << 8) | bytes[body + 3]) >>> 0;
  if (fnv(bytes, body) !== sum) return fail('The code is damaged or incomplete. Check that all of it was copied.');
  if (bytes[0] !== FORMAT) return fail('This code was made by a newer version of the game.');

  let at = 2;
  const refLen = bytes[1];
  if (refLen < 1 || refLen > 40 || at + refLen + 4 > body) return fail('The code is damaged.');
  let ref = '';
  for (let i = 0; i < refLen; i++) ref += String.fromCharCode(bytes[at++]);
  if (!/^[a-z0-9@-]+$/.test(ref)) return fail('The code is damaged.');
  const sig = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
  at += 4;

  const varint = (): number => {
    let v = 0;
    let scale = 1;
    for (let n = 0; n < 5; n++) {
      if (at >= body) return -1;
      const b = bytes[at++];
      v += (b & 0x7f) * scale;
      if (b < 0x80) return v;
      scale *= 128;
    }
    return -1;
  };
  const ticks = varint();
  const count = varint();
  if (ticks < 0 || count < 0 || count > MAX_GHOST_TOGGLES || ticks > 2_000_000) return fail('The code is damaged.');
  const toggles: number[] = [];
  let prev = 0;
  for (let i = 0; i < count; i++) {
    const d = varint();
    if (d < 0) return fail('The code is damaged.');
    prev += d;
    toggles.push(prev);
  }
  if (at !== body || prev > ticks) return fail('The code is damaged.');
  return { ok: true, run: { ref, sig, ticks, toggles } };
}

// ── Verify ─────────────────────────────────────────────────────────────────

function levelOf(ref: string): { level: Level; day: string | null } | string {
  const [id, day] = ref.split('@');
  if (id === DAILY_ID) {
    if (!isDateKey(day)) return 'The code does not say which daily remix it is for.';
    return { level: buildDaily(day).level, day };
  }
  if (day !== undefined || !(LEVEL_IDS as readonly string[]).includes(id)) return 'This game has no track by that name.';
  return { level: getLevel(id), day: null };
}

/**
 * Plays the inputs of a decoded run through the simulation and reports what
 * happens. Nothing in the answer comes from the code except the inputs.
 */
export function verifyRun(run: RunData): Checked {
  const found = levelOf(run.ref);
  if (typeof found === 'string') return { ok: false, reason: found };
  const { level, day } = found;
  if (runSignature(level) !== run.sig) {
    return { ok: false, reason: `This run was recorded on a different version of ${level.meta.name}, so it cannot be replayed here.` };
  }
  const sim = new Sim(level);
  const t = run.toggles;
  let i = 0;
  let held = false;
  while (!sim.dead && !sim.won && sim.tick < run.ticks) {
    while (i < t.length && t[i] <= sim.tick) { held = !held; i++; }
    sim.setInput(held);
    sim.step();
  }
  const sync = sim.actions > 0 ? sim.synced / sim.actions : 0;
  return {
    ok: true, run, level, levelId: level.meta.id, day,
    completed: sim.won,
    percent: sim.won ? 100 : Math.min(99, Math.floor(sim.progress * 100)),
    shards: sim.shards, sync, rank: syncRank(sync), bestStreak: sim.bestStreak, jumps: sim.jumps,
    ticks: sim.tick, seconds: sim.tick * DT,
    ending: sim.won ? 'cleared' : sim.dead ? 'crashed' : 'left',
  };
}

/** Decodes and verifies in one go. */
export function checkCode(text: string): Checked {
  const d = decodeRun(text);
  return d.ok ? verifyRun(d.run) : d;
}
