import { registerReplay } from '../levels/daily.ts';
import { levelFromDoc, parseLevelDoc } from '../levels/format.ts';
import { registerLevel } from '../levels/index.ts';
import { getSong } from '../music/songs.ts';
import type { Level } from '../sim/level.ts';
import { checkLevel, type LevelReport } from './check.ts';

/**
 * Play-testing a level document in the running game (development builds).
 *
 * The document is checked and built exactly as `npm run level -- check` does,
 * then put in the game under one fixed id. Runs on it are played like any
 * other but nothing is written to the save: it is not one of the tracks.
 */
export const PLAYTEST_ID = 'playtest';

export type Playtest =
  | { ok: true; level: Level; report: LevelReport; warnings: string[] }
  | { ok: false; errors: string[] };

export function loadPlaytest(value: unknown): Playtest {
  const parsed = parseLevelDoc(value);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  let song = null;
  try { song = getSong(parsed.doc.meta.song); } catch { song = null; }
  if (!song) return { ok: false, errors: [`meta.song: there is no song called "${parsed.doc.meta.song}"`] };
  const name = parsed.doc.meta.name;
  const level = levelFromDoc({ ...parsed.doc, meta: { ...parsed.doc.meta, id: PLAYTEST_ID, index: -1, name } });
  // A modest search: enough to solve an honest track, short enough not to hold the page up for long.
  const report = checkLevel(level, { song, maxNodes: 400_000 });
  registerLevel(PLAYTEST_ID, () => level);
  registerReplay(PLAYTEST_ID, report.toggles);
  return { ok: true, level, report, warnings: parsed.warnings };
}
