import type { Song } from '../../engine/audio/music.ts';
import { getSong, registerSong } from '../music/songs.ts';
import type { Level } from '../sim/level.ts';
import { dateKey, dayNumber } from './calendar.ts';
import { DAILY_ID, LEVEL_IDS, getLevel, registerLevel } from './index.ts';
import { entriesOf, isRemixOrder, partsOf, remixLevel, remixReplay, remixSong, type Part } from './remix.ts';
import { REMIXES } from './remixes.ts';
import { REPLAYS } from './replays.ts';

/**
 * The daily remix: one of the tracks with the parts of its song in a new
 * order, chosen by the date. Everything is worked out on the device from the
 * calendar day, so every player gets the same remix on the same day and
 * nothing is fetched.
 */
export { DAILY_ID };
export { dateKey, dayNumber, isDateKey, previousKey, shortDate } from './calendar.ts';

export interface DailyPlan {
  /** Local calendar day, YYYY-MM-DD. */
  key: string;
  /** The track the remix is made from. */
  source: string;
  /** Parts of the source in the order they are played. */
  order: number[];
}

export interface Daily extends DailyPlan {
  level: Level;
  song: Song;
  /** A run that clears the remix: the source's reference run, rearranged with it. */
  replay: number[];
  parts: Part[];
}

function mix(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Which remix a day gets. The tracks take turns: every block of as many days
 * as there are tracks uses each track once, in an order that changes from
 * block to block.
 */
export function dailyPlan(key: string): DailyPlan {
  const day = dayNumber(key);
  const n = LEVEL_IDS.length;
  const block = Math.floor(day / n);
  const turn = LEVEL_IDS.slice() as string[];
  for (let i = n - 1; i > 0; i--) {
    const j = mix(block * 31 + i) % (i + 1);
    [turn[i], turn[j]] = [turn[j], turn[i]];
  }
  const source = turn[((day % n) + n) % n];
  const orders = REMIXES[source];
  const order = orders[mix(day * 2654435761) % orders.length].split('').map(Number);
  return { key, source, order };
}

export function buildDaily(key: string): Daily {
  const plan = dailyPlan(key);
  const src = getLevel(plan.source);
  const srcSong = getSong(src.meta.song);
  const parts = partsOf(src, srcSong);
  if (!isRemixOrder(plan.order, parts.length)) throw new Error(`daily ${key}: stored order does not fit ${plan.source}`);
  const entries = entriesOf(src, REPLAYS[plan.source], parts);
  const level = remixLevel(src, parts, entries, plan.order, {
    ...src.meta, id: DAILY_ID, index: -1, name: 'Daily Remix', tagline: `${src.meta.name}, rearranged.`, song: DAILY_ID, stars: 0,
  });
  return {
    ...plan, level, parts,
    song: remixSong(srcSong, plan.order, DAILY_ID),
    replay: remixReplay(src, REPLAYS[plan.source], parts, plan.order),
  };
}

let active: Daily | null = null;

/** The remix in use. It stays the same until `refreshDaily` is called, so a run in progress never changes under the player. */
export function daily(): Daily {
  return active ?? refreshDaily();
}

/** Moves on to today's remix if the day has changed. Call it where the player picks what to play, not during a run. */
export function refreshDaily(now: Date = new Date()): Daily {
  const key = dateKey(now);
  if (!active || active.key !== key) {
    active = buildDaily(key);
    registerSong(active.song);
  }
  return active;
}

/** A run that clears the level, for the menu backdrop, previews and the route: the stored one, or the remix's own. */
export function referenceReplay(id: string): number[] | undefined {
  return id === DAILY_ID ? daily().replay : REPLAYS[id] ?? EXTRA.get(id);
}

/** Reference runs of levels added at run time (a document being play-tested). */
const EXTRA = new Map<string, number[]>();

export function registerReplay(id: string, toggles: number[] | null): void {
  if (toggles) EXTRA.set(id, toggles); else EXTRA.delete(id);
}

registerLevel(DAILY_ID, () => daily().level);
