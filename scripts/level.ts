/**
 * Tools for tracks written as level documents (JSON). See README, "Tracks as data".
 *
 *   npm run level -- check levels/example.json            check a document: format, song, and that it can be cleared
 *   npm run level -- check levels/example.json --jitter 0.08 --replay out.json
 *   npm run level -- export genesis                       write a built-in track as a document
 *   npm run level -- export all --out levels/exported
 *   npm run level -- ops                                  list every step a document can contain
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { checkLevel } from '../src/game/dev/check.ts';
import { VERIFY } from '../src/game/dev/verify.ts';
import { buildApex } from '../src/game/levels/apex.ts';
import { OPS, docFromBuilder, formatDoc, levelFromDoc, parseLevelDoc } from '../src/game/levels/format.ts';
import { buildGenesis } from '../src/game/levels/genesis.ts';
import { buildOverdrive } from '../src/game/levels/overdrive.ts';
import { buildQuantum } from '../src/game/levels/quantum.ts';
import { routeOf, MODE_NAME } from '../src/game/levels/route.ts';
import { buildVelocity } from '../src/game/levels/velocity.ts';
import { getSong } from '../src/game/music/songs.ts';
import type { Level } from '../src/game/sim/level.ts';

const BUILT_IN: Record<string, () => Level> = {
  genesis: buildGenesis, velocity: buildVelocity, overdrive: buildOverdrive, quantum: buildQuantum, apex: buildApex,
};

const argv = process.argv.slice(2);
const command = argv[0];
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const fail = (text: string): never => {
  console.error(text);
  process.exit(1);
};

function usage(): never {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^ \* ?/, '')).join('\n'));
  process.exit(command ? 1 : 0);
}

function check(): void {
  const file = argv[1];
  if (!file || file.startsWith('--')) fail('Which file? For example: npm run level -- check levels/example.json');
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(resolve(file), 'utf8'));
  } catch (e) {
    fail(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const parsed = parseLevelDoc(value);
  for (const w of parsed.warnings) console.log(`note     ${w}`);
  if (!parsed.ok) {
    for (const e of parsed.errors) console.log(`error    ${e}`);
    fail(`\n${file}: ${parsed.errors.length} ${parsed.errors.length === 1 ? 'problem' : 'problems'} in the document. Nothing was built.`);
    return;
  }
  const doc = parsed.doc;
  const level = levelFromDoc(doc);
  let song = null;
  try { song = getSong(doc.meta.song); } catch { song = null; }

  const jitterArg = flag('jitter');
  const jitter = jitterArg !== undefined ? Number(jitterArg) : VERIFY[doc.meta.id]?.jitter ?? 0.06;
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 0.25) fail('--jitter is the timing error allowed on every press, in beats: a number from 0 to 0.25');
  const nodes = Number(flag('nodes') ?? 3_000_000);

  const started = Date.now();
  const report = checkLevel(level, { song, jitter, maxNodes: nodes });
  const c = report.counts;
  console.log(`${doc.meta.name} (${doc.meta.id}) · ${doc.meta.bpm} BPM · ${level.endBeat} beats · ${Math.floor(report.seconds / 60)}:${String(Math.round(report.seconds % 60)).padStart(2, '0')}`);
  console.log(`  ${doc.steps.length} steps → ${c.spikes} spikes, ${c.saws} saws, ${c.solids} solids, ${c.pits} pits, ${c.pads} pads, ${c.orbs} orbs, ${c.gates} gates`);
  for (const n of report.notes) console.log(`note     ${n}`);
  for (const p of report.problems) console.log(`error    ${p}`);
  if (!report.ok || !report.toggles) {
    fail(`\n${file}: not ready. (${((Date.now() - started) / 1000).toFixed(1)} s, ${report.nodes} positions searched)`);
    return;
  }
  console.log(`ok       Can be cleared with all three shards with every press up to ±${jitter} beat off (${report.toggles.length} inputs, ${Math.round(report.syncRate * 100)}% on the beat).`);

  const out = flag('replay');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), `${JSON.stringify({ level: doc.meta.id, toggles: report.toggles })}\n`);
    console.log(`         Winning inputs written to ${out}`);
  }
  console.log(`\n${file}: ready. (${((Date.now() - started) / 1000).toFixed(1)} s)`);
}

function exportDocs(): void {
  const which = argv[1];
  const ids = which === 'all' ? Object.keys(BUILT_IN) : which ? [which] : [];
  if (ids.length === 0 || ids.some((id) => !BUILT_IN[id])) fail(`Which track? One of: ${Object.keys(BUILT_IN).join(', ')}, all`);
  const dir = resolve(flag('out') ?? 'levels/exported');
  mkdirSync(dir, { recursive: true });
  for (const id of ids) {
    const doc = docFromBuilder(BUILT_IN[id]);
    const path = join(dir, `${id}.json`);
    writeFileSync(path, formatDoc(doc));
    const route = routeOf(id);
    console.log(`${id.padEnd(10)} ${String(doc.steps.length).padStart(4)} steps → ${path}  (${route.share.map((s, i) => `${MODE_NAME[i]} ${Math.round(s * 100)}%`).join(', ')})`);
  }
}

function ops(): void {
  for (const [name, info] of Object.entries(OPS)) {
    console.log(`${name}\n    ${info.about}`);
    for (const q of info.params) console.log(`    ${(q.optional ? `[${q.name}]` : q.name).padEnd(10)} ${q.about}`);
  }
}

if (command === 'check') check();
else if (command === 'export') exportDocs();
else if (command === 'ops') ops();
else usage();
