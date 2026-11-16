import { Kind } from '../sim/constants.ts';
import { beatAtX, type Level } from '../sim/level.ts';
import type { Song } from '../../engine/audio/music.ts';
import { replay, solve, type SolveOptions } from './solver.ts';

/**
 * The checks every track has to pass before it ships, gathered in one place
 * so that a level written as a document gets exactly the scrutiny the
 * built-in tracks get from the tests and from `npm run replays`.
 */

export interface LevelReport {
  /** True when nothing below is a failure. */
  ok: boolean;
  /** What stops the level from shipping. */
  problems: string[];
  /** Things worth a look that do not stop it. */
  notes: string[];
  seconds: number;
  counts: { solids: number; spikes: number; saws: number; pads: number; orbs: number; gates: number; pits: number };
  /** A run that clears the level with all three shards, when one was found. */
  toggles: number[] | null;
  jitter: number;
  nodes: number;
  syncRate: number;
}

export interface CheckOptions extends Partial<SolveOptions> {
  /** The song the level names, when it could be found. */
  song?: Song | null;
}

export function checkLevel(level: Level, options: CheckOptions = {}): LevelReport {
  const { song, ...solveOptions } = options;
  const problems: string[] = [];
  const notes: string[] = [];
  const count = (k: number): number => level.objs.filter((o) => o.kind === k).length;
  const counts = {
    solids: count(Kind.Solid), spikes: count(Kind.Spike), saws: count(Kind.Saw), pads: count(Kind.Pad),
    orbs: count(Kind.Orb), gates: count(Kind.Gate), pits: level.pits.length,
  };
  const seconds = level.endBeat * level.beatDur;

  if (level.shards.length !== 3) problems.push(`A track has exactly 3 shards; this one has ${level.shards.length}.`);
  if (song === null) problems.push(`There is no song called "${level.meta.song}".`);
  if (song) {
    if (song.bpm !== level.meta.bpm) problems.push(`The track is at ${level.meta.bpm} BPM but its song "${song.id}" is at ${song.bpm}: nothing would land on the beat.`);
    const beats = song.sections.reduce((n, s) => n + s.bars * 4, 0);
    if (level.endBeat > beats) notes.push(`The track ends at beat ${level.endBeat} but the song is ${beats} beats long${song.loop ? ' and will start again' : ''}.`);
    else if (level.endBeat < beats) notes.push(`The song is ${beats} beats long; the track ends at beat ${level.endBeat}, so the rest is never heard.`);
  }
  if (seconds < 10) notes.push(`The track lasts ${seconds.toFixed(1)} seconds.`);

  if (replay(level, []).won) problems.push('A player who never presses anything reaches the end.');

  const r = solve(level, solveOptions);
  const jitter = solveOptions.jitter ?? 0.06;
  let toggles: number[] | null = null;
  if (r.ok) {
    const run = replay(level, r.toggles);
    if (!run.won || run.shards !== 7) problems.push('The solver found a run, but replaying it did not clear the track with all shards. This is a fault in the tools, not in the level.');
    else toggles = r.toggles;
  } else {
    // Find out whether the track itself is the trouble or only a shard.
    const bare = solve(level, { ...solveOptions, requireShards: false });
    if (bare.ok) {
      // With shards required, a run ends where it passes one it could not take.
      const beats = level.shards.map((o) => beatAtX(level, o.x));
      let at = beats.findIndex((b) => b > r.maxBeat) - 1;
      if (at < 0) at = beats.findIndex((b) => b > r.maxBeat) === -1 ? beats.length - 1 : 0;
      problems.push(`The track can be cleared, but not with all three shards inside ±${jitter} beat of timing error. The search that takes them got to beat ${r.maxBeat.toFixed(1)}, so look at shard ${at + 1} (beat ${beats[at].toFixed(1)}). Solver detail: ${r.death}`);
    } else {
      problems.push(`No run clears the track inside ±${jitter} beat of timing error. The furthest any run got is beat ${r.maxBeat.toFixed(1)} of ${level.endBeat}. Solver detail: ${r.death}`);
    }
  }
  return { ok: problems.length === 0, problems, notes, seconds, counts, toggles, jitter, nodes: r.nodes, syncRate: r.syncRate };
}
