import { Gate, Orb, Pad, Style } from '../sim/constants.ts';
import {
  LevelBuilder, traceBuilders, type BuilderTrace, type Difficulty, type Level, type LevelMeta, type Theme,
} from '../sim/level.ts';

/**
 * Level documents: a track written as data instead of code.
 *
 * A document is plain JSON. It lists, in order, the same steps a level
 * written in TypeScript makes on a `LevelBuilder`, each with its arguments by
 * name:
 *
 *     { "op": "spikes", "beat": 6.5, "n": 2 }
 *
 * The table below (`OPS`) is the whole vocabulary. It is used three ways: to
 * check a document and say exactly what is wrong with it, to build the level,
 * and to write a document from a level that exists as code. Because all three
 * read the same table, a level and its document cannot drift apart.
 *
 * Positions along the track are in beats, as in the builder, so an object
 * placed at beat 6.5 is where the player is at that moment of the song
 * whatever the speed changes before it.
 */

export const LEVEL_FORMAT = 1;
/** Most steps accepted in one document. */
export const MAX_STEPS = 5000;

export interface LevelDocMeta {
  id: string;
  name: string;
  tagline: string;
  difficulty: Difficulty;
  /** 1 (easiest) to 5: how many bars the difficulty meter shows. */
  tier: number;
  /** Stars a first clear is worth. */
  stars: number;
  bpm: number;
  /** Id of the song it is played to (see music/songs.ts). */
  song: string;
  /** Short labels for what the track teaches, shown on its card. */
  mechanics: string[];
  /** Colour sets; `theme` steps switch between them by position in this list. */
  themes: Theme[];
  /** Place in the track list, from 0. Optional: a document on its own has none. */
  index?: number;
}

export type Step = { op: string } & Record<string, unknown>;

export interface LevelDoc {
  format: number;
  meta: LevelDocMeta;
  /** Speed changes as [beat, multiplier], in order. A speed gate is drawn at each. */
  speeds?: [number, number][];
  /** Beat at which the track is won. */
  end: number;
  steps: Step[];
}

// ── Vocabulary ─────────────────────────────────────────────────────────────

type Names = Record<string, number>;
const lower = (o: Record<string, number>, skip: string[] = []): Names =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !skip.includes(k)).map(([k, v]) => [k.toLowerCase(), v]));

const STYLE = lower(Style, ['Ground']);
const PAD = lower(Pad);
const ORB = lower(Orb);
/** Speed gates come from `speeds`; dual and solo gates have steps of their own because they need a mirror line. */
const GATE = lower(Gate, ['Speed', 'Dual', 'Solo']);

type Kind =
  | { t: 'num'; min?: number; max?: number }
  | { t: 'int'; min?: number; max?: number }
  | { t: 'bool' }
  | { t: 'text'; max: number }
  | { t: 'name'; of: Names }
  | { t: 'move' };

interface Param { name: string; kind: Kind; optional: boolean; about: string }

const num = (min?: number, max?: number): Kind => ({ t: 'num', min, max });
const int = (min?: number, max?: number): Kind => ({ t: 'int', min, max });
const p = (name: string, kind: Kind, about: string): Param => ({ name, kind, optional: false, about });
const opt = (name: string, kind: Kind, about: string): Param => ({ name, kind, optional: true, about });

const BEAT = num(-8, 4000);
const HEIGHT = num(-20, 40);
const beat = p('beat', BEAT, 'beat it is centred on');
const b0 = p('b0', BEAT, 'beat it starts at');
const b1 = p('b1', BEAT, 'beat it ends at');
const style = opt('style', { t: 'name', of: STYLE }, 'how it is drawn: block, slab or ceiling (default block)');

export interface OpInfo { params: Param[]; about: string }

/** Every step a document can contain. The order of `params` is the order of the builder's arguments. */
export const OPS: Record<string, OpInfo> = {
  block: { about: 'Solid block between two beats.', params: [b0, b1, p('y0', HEIGHT, 'bottom'), p('y1', HEIGHT, 'top'), style] },
  blockAt: { about: 'Solid block centred on a beat.', params: [beat, p('w', num(0.05, 400), 'width in cells'), p('y0', HEIGHT, 'bottom'), p('y1', HEIGHT, 'top'), style] },
  rect: { about: 'Solid block given in cells rather than beats.', params: [p('x0', num(-100, 20000), 'left edge in cells'), p('x1', num(-100, 20000), 'right edge in cells'), p('y0', HEIGHT, 'bottom'), p('y1', HEIGHT, 'top'), style] },
  slab: { about: 'Thin platform, half a cell thick.', params: [b0, b1, p('top', HEIGHT, 'height of its upper surface')] },
  slabAt: { about: 'Thin platform centred on a beat.', params: [beat, p('w', num(0.05, 400), 'width in cells'), p('top', HEIGHT, 'height of its upper surface')] },
  ceiling: { about: 'Ceiling from a height upwards.', params: [b0, b1, p('y', HEIGHT, 'height of its underside')] },
  spikes: { about: 'Floor spikes in a row.', params: [beat, opt('n', int(1, 64), 'how many (default 1)'), opt('y', HEIGHT, 'height they stand on (default 0)'), opt('small', { t: 'bool' }, 'half-height spikes')] },
  spikesDown: { about: 'Spikes hanging from a ceiling.', params: [beat, opt('n', int(1, 64), 'how many (default 1)'), opt('y', HEIGHT, 'height they hang from (default 0)'), opt('small', { t: 'bool' }, 'half-height spikes')] },
  spikeStrip: { about: 'Unbroken strip of small spikes.', params: [b0, b1, p('y', HEIGHT, 'height of the surface they are on'), opt('down', { t: 'bool' }, 'hanging from a ceiling')] },
  saw: { about: 'Circular saw, still or moving.', params: [beat, p('y', HEIGHT, 'height of its centre'), opt('r', num(0.2, 8), 'radius in cells (default 1)'), opt('move', { t: 'move' }, 'travel: { dx, dy, period, phase }')] },
  bobSaw: { about: 'Saw that swings up and down in time, clear of the player as they arrive.', params: [beat, p('ySafe', HEIGHT, 'where it is when the player arrives'), opt('r', num(0.2, 8), 'radius (default 1)'), opt('amp', num(0, 12), 'half its travel (default 1.3)'), opt('period', num(0.25, 64), 'beats per swing (default 2)')] },
  pad: { about: 'Launch pad.', params: [beat, opt('y', HEIGHT, 'height of the surface it is on (default 0)'), opt('kind', { t: 'name', of: PAD }, 'jump or gravity (default jump)'), opt('ceiling', { t: 'bool' }, 'fixed under a ceiling')] },
  gravPad: { about: 'Pad that turns gravity over.', params: [beat, opt('y', HEIGHT, 'height of the surface it is on (default 0)'), opt('ceiling', { t: 'bool' }, 'fixed under a ceiling')] },
  orb: { about: 'Orb to press on in mid-air.', params: [beat, p('y', HEIGHT, 'height'), opt('kind', { t: 'name', of: ORB }, 'jump or gravity (default jump)')] },
  gravOrb: { about: 'Orb that turns gravity over.', params: [beat, p('y', HEIGHT, 'height')] },
  gate: { about: 'Gate that changes vehicle, gravity or size.', params: [beat, p('kind', { t: 'name', of: GATE }, Object.keys(GATE).join(', ')), opt('y', HEIGHT, 'where its frame is drawn (default 1.5)')] },
  dual: { about: 'Starts dual mode: a twin mirrored in the line y = mirror.', params: [beat, p('mirror', HEIGHT, 'height of the mirror line'), opt('y', HEIGHT, 'where its frame is drawn (default 1.5)')] },
  solo: { about: 'Ends dual mode.', params: [beat, p('mirror', HEIGHT, 'height of the mirror line'), opt('y', HEIGHT, 'where its frame is drawn (default 1.5)')] },
  shard: { about: 'Collectable shard. A track has exactly three.', params: [beat, p('y', HEIGHT, 'height')] },
  pit: { about: 'Hole in the ground between two beats.', params: [b0, b1] },
  pitAt: { about: 'Hole in the ground centred on a beat.', params: [beat, p('w', num(0.05, 400), 'width in cells')] },
  theme: { about: 'Changes to another colour set.', params: [beat, p('theme', int(0, 15), 'position in meta.themes, from 0')] },
  text: { about: 'Words shown over the track.', params: [beat, p('text', { t: 'text', max: 60 }, 'the line'), opt('sub', { t: 'text', max: 90 }, 'smaller line under it')] },
  zoom: { about: 'Camera zoom from here on.', params: [beat, p('zoom', num(0.4, 2.5), '1 is normal')] },
  flash: { about: 'White flash on the beat.', params: [beat] },
  note: { about: 'A remark for whoever reads the file. It does nothing.', params: [p('text', { t: 'text', max: 400 }, 'the remark')] },
};

const DIFFICULTIES: Difficulty[] = ['Easy', 'Normal', 'Hard', 'Harder', 'Insane'];
const THEME_KEYS: (keyof Theme)[] = ['sky0', 'sky1', 'accent', 'accent2', 'hazard'];
const MOVE_KEYS = ['dx', 'dy', 'period', 'phase'];

// ── Check ──────────────────────────────────────────────────────────────────

export type Parsed =
  | { ok: true; doc: LevelDoc; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function nearest(word: string, among: string[]): string {
  // Small edit distance, enough to catch a slip of the finger.
  let best = '';
  let score = 3;
  for (const w of among) {
    const a = word.toLowerCase(), b = w.toLowerCase();
    if (Math.abs(a.length - b.length) >= score) continue;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const keep = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = keep;
      }
    }
    if (row[b.length] < score) { score = row[b.length]; best = w; }
  }
  return best ? ` Did you mean "${best}"?` : '';
}

function checkValue(v: unknown, kind: Kind, at: string, errors: string[]): void {
  switch (kind.t) {
    case 'num':
    case 'int':
      if (!isNum(v)) { errors.push(`${at}: expected a number, found ${describe(v)}`); return; }
      if (kind.t === 'int' && !Number.isInteger(v)) errors.push(`${at}: expected a whole number, found ${v}`);
      if (kind.min !== undefined && v < kind.min) errors.push(`${at}: ${v} is below the smallest allowed, ${kind.min}`);
      if (kind.max !== undefined && v > kind.max) errors.push(`${at}: ${v} is above the largest allowed, ${kind.max}`);
      return;
    case 'bool':
      if (typeof v !== 'boolean') errors.push(`${at}: expected true or false, found ${describe(v)}`);
      return;
    case 'text':
      if (typeof v !== 'string') errors.push(`${at}: expected text, found ${describe(v)}`);
      else if (v.length > kind.max) errors.push(`${at}: longer than ${kind.max} characters`);
      return;
    case 'name':
      if (typeof v !== 'string' || !(v in kind.of)) {
        errors.push(`${at}: expected one of ${Object.keys(kind.of).join(', ')}; found ${describe(v)}.${typeof v === 'string' ? nearest(v, Object.keys(kind.of)) : ''}`);
      }
      return;
    case 'move':
      if (!isObj(v)) { errors.push(`${at}: expected { dx, dy, period, phase }, found ${describe(v)}`); return; }
      for (const k of Object.keys(v)) {
        if (!MOVE_KEYS.includes(k)) errors.push(`${at}.${k}: not part of a saw's travel.${nearest(k, MOVE_KEYS)}`);
        else if (!isNum(v[k])) errors.push(`${at}.${k}: expected a number, found ${describe(v[k])}`);
      }
      if (isNum(v.period) && v.period <= 0) errors.push(`${at}.period: must be more than 0`);
  }
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'a list';
  if (typeof v === 'string') return `"${v.length > 24 ? `${v.slice(0, 24)}…` : v}"`;
  if (typeof v === 'object') return 'an object';
  return String(v);
}

/**
 * Checks anything (usually the result of `JSON.parse`) and either accepts it
 * as a level document or lists everything wrong with it, each with the place
 * in the file it was found.
 */
export function parseLevelDoc(value: unknown): Parsed {
  const errors: string[] = [];
  const warnings: string[] = [];
  const done = (): Parsed => ({ ok: false, errors, warnings });
  if (!isObj(value)) { errors.push('The file must hold one object: { "format", "meta", "end", "steps" }.'); return done(); }
  for (const k of Object.keys(value)) {
    if (!['format', 'meta', 'speeds', 'end', 'steps', '$schema'].includes(k)) errors.push(`${k}: not part of a level.${nearest(k, ['format', 'meta', 'speeds', 'end', 'steps'])}`);
  }
  if (value.format !== LEVEL_FORMAT) errors.push(`format: expected ${LEVEL_FORMAT}, found ${describe(value.format)}`);

  // meta
  const m = value.meta;
  if (!isObj(m)) errors.push('meta: missing. It holds the id, name, bpm, song and colours.');
  else {
    const text = (k: string, max: number, pattern?: RegExp): void => {
      const v = m[k];
      if (typeof v !== 'string' || v === '') errors.push(`meta.${k}: expected text`);
      else if (v.length > max) errors.push(`meta.${k}: longer than ${max} characters`);
      else if (pattern && !pattern.test(v)) errors.push(`meta.${k}: "${v}" must be lower-case letters, digits and hyphens, starting with a letter`);
    };
    text('id', 24, /^[a-z][a-z0-9-]*$/);
    text('name', 24);
    text('tagline', 80);
    text('song', 24, /^[a-z][a-z0-9-]*$/);
    if (!DIFFICULTIES.includes(m.difficulty as Difficulty)) errors.push(`meta.difficulty: expected one of ${DIFFICULTIES.join(', ')}; found ${describe(m.difficulty)}`);
    checkValue(m.tier, int(1, 5), 'meta.tier', errors);
    checkValue(m.stars, int(0, 20), 'meta.stars', errors);
    checkValue(m.bpm, num(60, 240), 'meta.bpm', errors);
    if (m.index !== undefined) checkValue(m.index, int(-1, 99), 'meta.index', errors);
    if (!Array.isArray(m.mechanics) || m.mechanics.some((x) => typeof x !== 'string' || x.length > 24)) errors.push('meta.mechanics: expected a list of short labels');
    else if (m.mechanics.length > 6) errors.push('meta.mechanics: at most 6 labels fit on the card');
    if (!Array.isArray(m.themes) || m.themes.length === 0) errors.push('meta.themes: expected at least one colour set');
    else {
      if (m.themes.length > 16) errors.push('meta.themes: at most 16 colour sets');
      m.themes.forEach((t, i) => {
        if (!isObj(t)) { errors.push(`meta.themes[${i}]: expected { ${THEME_KEYS.join(', ')} }`); return; }
        for (const k of THEME_KEYS) {
          if (typeof t[k] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(t[k] as string)) errors.push(`meta.themes[${i}].${k}: expected a colour such as "#00e5ff", found ${describe(t[k])}`);
        }
        for (const k of Object.keys(t)) if (!(THEME_KEYS as string[]).includes(k)) errors.push(`meta.themes[${i}].${k}: not part of a colour set.${nearest(k, THEME_KEYS)}`);
      });
    }
    const known = ['id', 'name', 'tagline', 'difficulty', 'tier', 'stars', 'bpm', 'song', 'mechanics', 'themes', 'index'];
    for (const k of Object.keys(m)) if (!known.includes(k)) errors.push(`meta.${k}: not part of a level's description.${nearest(k, known)}`);
  }

  // end, speeds
  const end = value.end;
  if (!isNum(end) || end <= 0 || end > 4000) errors.push(`end: expected the beat the track is won at, a number above 0; found ${describe(end)}`);
  if (value.speeds !== undefined) {
    if (!Array.isArray(value.speeds)) errors.push('speeds: expected a list of [beat, speed] pairs');
    else {
      let last = 0;
      value.speeds.forEach((s, i) => {
        if (!Array.isArray(s) || s.length !== 2 || !isNum(s[0]) || !isNum(s[1])) { errors.push(`speeds[${i}]: expected [beat, speed], for example [64, 1.25]`); return; }
        if (s[0] <= last) errors.push(`speeds[${i}]: beat ${s[0]} must come after ${i === 0 ? 'beat 0' : `the change before it (beat ${last})`}`);
        if (s[1] < 0.5 || s[1] > 3) errors.push(`speeds[${i}]: speed ${s[1]} is outside 0.5 to 3`);
        if (isNum(end) && s[0] >= end) warnings.push(`speeds[${i}]: beat ${s[0]} is after the end of the track (beat ${end})`);
        last = s[0];
      });
    }
  }

  // steps
  const steps = value.steps;
  if (!Array.isArray(steps)) errors.push('steps: expected the list of things on the track');
  else {
    if (steps.length > MAX_STEPS) errors.push(`steps: ${steps.length} steps; at most ${MAX_STEPS}`);
    const themes = isObj(m) && Array.isArray(m.themes) ? m.themes.length : 0;
    let shards = 0;
    let dual: number | null = null;
    steps.slice(0, MAX_STEPS).forEach((s, i) => {
      const at = `steps[${i}]`;
      if (!isObj(s)) { errors.push(`${at}: expected an object such as { "op": "spikes", "beat": 6.5 }`); return; }
      const name = s.op;
      if (typeof name !== 'string') { errors.push(`${at}: "op" is missing. It says what the step is, for example "spikes".`); return; }
      const info = Object.hasOwn(OPS, name) ? OPS[name] : undefined;
      if (!info) { errors.push(`${at}: there is no step called "${name}".${nearest(name, Object.keys(OPS))}`); return; }
      const where = `${at} (${name})`;
      for (const q of info.params) {
        const v = s[q.name];
        if (v === undefined) {
          if (!q.optional) errors.push(`${where}: "${q.name}" is missing (${q.about})`);
          continue;
        }
        checkValue(v, q.kind, `${where}.${q.name}`, errors);
      }
      const names = info.params.map((q) => q.name);
      for (const k of Object.keys(s)) if (k !== 'op' && !names.includes(k)) errors.push(`${where}.${k}: "${name}" takes ${names.length ? names.join(', ') : 'nothing'}.${nearest(k, names)}`);

      if (isNum(s.b0) && isNum(s.b1) && s.b1 <= s.b0) errors.push(`${where}: b1 (${s.b1}) must come after b0 (${s.b0})`);
      if (isNum(s.x0) && isNum(s.x1) && s.x1 <= s.x0) errors.push(`${where}: x1 (${s.x1}) must be right of x0 (${s.x0})`);
      if (isNum(s.y0) && isNum(s.y1) && s.y1 <= s.y0) errors.push(`${where}: y1 (${s.y1}) must be above y0 (${s.y0})`);
      if (name === 'theme' && isNum(s.theme) && themes > 0 && s.theme >= themes) errors.push(`${where}.theme: ${s.theme} is past the last colour set (${themes - 1})`);
      if (name === 'shard') shards++;
      if (name === 'dual') { if (dual !== null) errors.push(`${where}: dual mode is already on since steps[${dual}]`); dual = i; }
      if (name === 'solo') { if (dual === null) errors.push(`${where}: there is no dual gate before it to end`); dual = null; }
      if (isNum(end)) {
        const b = isNum(s.beat) ? s.beat : isNum(s.b0) ? s.b0 : null;
        if (b !== null && b > end && name !== 'note') warnings.push(`${where}: beat ${b} is after the end of the track (beat ${end}); it will never be reached`);
      }
    });
    if (dual !== null) errors.push(`steps[${dual}] (dual): dual mode is never ended. Add a "solo" step.`);
    if (shards !== 3) errors.push(`steps: a track has exactly 3 shards; this one has ${shards}`);
  }

  if (errors.length > 0) return done();
  return { ok: true, doc: value as unknown as LevelDoc, warnings };
}

// ── Build ──────────────────────────────────────────────────────────────────

/** Compiles a checked document into a level the game can run. */
export function levelFromDoc(doc: LevelDoc): Level {
  const meta: LevelMeta = { ...doc.meta, index: doc.meta.index ?? -1, mechanics: [...doc.meta.mechanics], themes: doc.meta.themes.map((t) => ({ ...t })) };
  const builder = new LevelBuilder(meta, (doc.speeds ?? []).map(([b, v]) => [b, v]));
  const call = builder as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const step of doc.steps) {
    if (step.op === 'note') continue;
    const info = OPS[step.op];
    const args = info.params.map((q) => {
      const v = step[q.name];
      return v !== undefined && q.kind.t === 'name' ? q.kind.of[v as string] : v;
    });
    // Arguments left out at the end fall back to the builder's own defaults.
    while (args.length > 0 && args[args.length - 1] === undefined) args.pop();
    call[step.op](...args);
  }
  return builder.end(doc.end).build();
}

/** Checks and builds in one go. Throws with every problem listed when the document is not valid. */
export function loadLevel(value: unknown): Level {
  const parsed = parseLevelDoc(value);
  if (!parsed.ok) throw new Error(`Not a valid level:\n  ${parsed.errors.join('\n  ')}`);
  return levelFromDoc(parsed.doc);
}

// ── Write ──────────────────────────────────────────────────────────────────

const nameOf = (of: Names, v: unknown): string | undefined => Object.keys(of).find((k) => of[k] === v);

/** Turns what a builder was asked to do into a document that builds the same level. */
export function docFromTrace(trace: BuilderTrace): LevelDoc {
  const steps: Step[] = [];
  let end = 0;
  for (const { op, args } of trace.calls) {
    if (op === 'end') { end = args[0] as number; continue; }
    if (op === 'build' || op === 'x') continue;
    const info = Object.hasOwn(OPS, op) ? OPS[op] : undefined;
    if (!info) throw new Error(`The level format has no step for LevelBuilder.${op}()`);
    const step: Step = { op };
    info.params.forEach((q, i) => {
      const v = args[i];
      if (v === undefined) return;
      if (q.kind.t === 'name') {
        const name = nameOf(q.kind.of, v);
        if (name === undefined) throw new Error(`${op}.${q.name}: ${String(v)} has no name in the level format`);
        step[q.name] = name;
      } else step[q.name] = v;
    });
    steps.push(step);
  }
  const { index, ...meta } = trace.meta;
  const doc: LevelDoc = {
    format: LEVEL_FORMAT,
    meta: { ...meta, index, mechanics: [...meta.mechanics], themes: meta.themes.map((t) => ({ ...t })) },
    end,
    steps,
  };
  if (trace.speeds.length > 0) doc.speeds = trace.speeds.map(([b, v]) => [b, v]);
  return doc;
}

/** Writes the document of a level that is built in code. `build` is the function that makes it. */
export function docFromBuilder(build: () => Level): LevelDoc {
  const { traces } = traceBuilders(build);
  if (traces.length !== 1) throw new Error(`expected one LevelBuilder, saw ${traces.length}`);
  return docFromTrace(traces[0]);
}

/**
 * JSON for a document, laid out to be read and edited by hand: one step per
 * line, a blank line wherever a note starts a new part.
 */
export function formatDoc(doc: LevelDoc): string {
  const line = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(line).join(', ')}]`;
    if (typeof v !== 'object' || v === null) return JSON.stringify(v);
    const fields = Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${JSON.stringify(k)}: ${line(x)}`);
    return `{ ${fields.join(', ')} }`;
  };
  const meta = doc.meta;
  const out: string[] = ['{', `  "format": ${doc.format},`, '  "meta": {'];
  const keys = Object.keys(meta).filter((k) => k !== 'themes' && (meta as unknown as Record<string, unknown>)[k] !== undefined);
  for (const k of keys) out.push(`    ${JSON.stringify(k)}: ${line((meta as unknown as Record<string, unknown>)[k])},`);
  out.push('    "themes": [');
  meta.themes.forEach((t, i) => out.push(`      ${line(t)}${i < meta.themes.length - 1 ? ',' : ''}`));
  out.push('    ]', '  },');
  if (doc.speeds?.length) out.push(`  "speeds": [${doc.speeds.map((s) => `[${s[0]}, ${s[1]}]`).join(', ')}],`);
  out.push(`  "end": ${doc.end},`, '  "steps": [');
  doc.steps.forEach((s, i) => {
    if (s.op === 'note' && i > 0) out.push('');
    out.push(`    ${line(s)}${i < doc.steps.length - 1 ? ',' : ''}`);
  });
  out.push('  ]', '}', '');
  return out.join('\n');
}
