import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACTIONS, ACTION_IDS, actionOf, bindKey, clearKey, defaultBindings, isBindable, keyLabel, sameBindings, sanitizeBindings,
} from '../src/game/progression/keys.ts';
import {
  SETTINGS_SECTIONS, STORAGE_KEY, defaultProfile, defaultSettings, sanitizeProfile, sectionIsDefault, sectionValues,
} from '../src/game/progression/profile.ts';
import { BACKUP_KEY, MAX_SAVE_CHARS, ProfileStore, checkSave, isBlankSave, summarizeSave, type RunReport } from '../src/game/progression/store.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}
const run = (over: Partial<RunReport> = {}): RunReport => ({
  levelId: 'genesis', practice: false, completed: false, died: true, progress: 0.5, seconds: 30,
  jumps: 10, orbs: 0, pads: 0, actions: 10, synced: 5, bestStreak: 3, shards: 0, sessionAttempts: 1, ...over,
});
/** A store whose player has cleared the first track. */
function played(mem = memory()) {
  const store = new ProfileStore(mem);
  store.beginAttempt('genesis', false);
  store.recordRun(run({ completed: true, progress: 1, shards: 0b011 }));
  return { store, mem };
}

// ── Key bindings ────────────────────────────────────────────────────────────

test('keys: defaults match the controls the game shipped with', () => {
  assert.deepEqual(defaultBindings(), { jump: ['Space', 'ArrowUp', 'KeyW', 'KeyX'], pause: ['KeyP'], restart: ['KeyR'], checkpoint: ['KeyZ'] });
  for (const a of ACTIONS) assert.ok(defaultBindings()[a.id].length <= a.slots, a.id);
  const all = ACTION_IDS.flatMap((id) => defaultBindings()[id]);
  assert.equal(new Set(all).size, all.length, 'no key is bound twice');
  assert.ok(all.every(isBindable));
});

test('keys: reserved and malformed keys cannot be bound', () => {
  for (const code of ['Escape', 'Enter', 'NumpadEnter', 'Tab', 'Backspace', 'Delete', 'MetaLeft', 'AltLeft', 'F5', 'F11', 'ContextMenu', '', 'Unidentified']) {
    assert.equal(isBindable(code), false, code);
  }
  for (const code of [42, null, undefined, {}, 'Key W', '<script>', 'x'.repeat(40)]) assert.equal(isBindable(code), false, String(code));
  for (const code of ['KeyJ', 'Space', 'ArrowDown', 'ShiftLeft', 'Digit1', 'Numpad0', 'Comma']) assert.equal(isBindable(code), true, code);
});

test('keys: labels are short and readable', () => {
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('Digit7'), '7');
  assert.equal(keyLabel('ArrowUp'), '↑');
  assert.equal(keyLabel('Space'), 'Space');
  assert.equal(keyLabel('ShiftLeft'), 'L Shift');
  assert.equal(keyLabel('Numpad4'), 'Num 4');
  assert.equal(keyLabel('IntlRo'), 'IntlRo', 'unknown keys fall back to their code');
});

test('keys: binding replaces a slot, appends, and never exceeds the slots', () => {
  const d = defaultBindings();
  let r = bindKey(d, 'jump', 0, 'KeyJ');
  assert.deepEqual(r.bindings.jump, ['KeyJ', 'ArrowUp', 'KeyW', 'KeyX']);
  assert.equal(r.movedFrom, null);
  assert.deepEqual(d.jump, ['Space', 'ArrowUp', 'KeyW', 'KeyX'], 'the input is not mutated');
  r = bindKey(d, 'pause', 1, 'KeyO');
  assert.deepEqual(r.bindings.pause, ['KeyP', 'KeyO']);
  r = bindKey(r.bindings, 'pause', 2, 'KeyI');
  assert.deepEqual(r.bindings.pause, ['KeyP', 'KeyI'], 'a full action replaces its last key');
  r = bindKey(d, 'jump', 9, 'KeyJ');
  assert.equal(r.bindings.jump.length, 4);
  assert.equal(bindKey(d, 'jump', 0, 'Enter').bindings, d, 'a reserved key changes nothing');
});

test('keys: a key belongs to one action, and moving it is reported', () => {
  const d = defaultBindings();
  const r = bindKey(d, 'pause', 1, 'KeyR');
  assert.deepEqual(r.bindings.pause, ['KeyP', 'KeyR']);
  assert.deepEqual(r.bindings.restart, []);
  assert.equal(r.movedFrom, 'restart');
  assert.equal(actionOf(r.bindings, 'KeyR'), 'pause');
  // Rebinding a key the action already has only reorders it.
  const same = bindKey(d, 'jump', 0, 'KeyW');
  assert.deepEqual(same.bindings.jump, ['KeyW', 'Space', 'ArrowUp', 'KeyX']);
  assert.equal(same.movedFrom, null);
  for (const b of [r.bindings, same.bindings]) {
    const all = ACTION_IDS.flatMap((id) => b[id]);
    assert.equal(new Set(all).size, all.length);
  }
});

test('keys: clearing a key, and comparing bindings', () => {
  const d = defaultBindings();
  const c = clearKey(d, 'jump', 3);
  assert.deepEqual(c.jump, ['Space', 'ArrowUp', 'KeyW']);
  assert.deepEqual(clearKey(d, 'restart', 0).restart, []);
  assert.equal(sameBindings(d, defaultBindings()), true);
  assert.equal(sameBindings(d, c), false);
});

test('keys: untrusted bindings are repaired', () => {
  assert.deepEqual(sanitizeBindings(undefined), defaultBindings());
  assert.deepEqual(sanitizeBindings('nope'), defaultBindings());
  assert.deepEqual(sanitizeBindings({ jump: 'Space' }), defaultBindings());
  const s = sanitizeBindings({ jump: ['KeyJ', 'KeyJ', 'Escape', 7, 'KeyK', 'KeyL', 'KeyM', 'KeyN'], pause: ['KeyJ', 'KeyR'], restart: [] });
  assert.deepEqual(s.jump, ['KeyJ', 'KeyK', 'KeyL', 'KeyM'], 'duplicates, reserved keys and extras are dropped');
  assert.deepEqual(s.pause, ['KeyR'], 'a key claimed by an earlier action is not shared');
  assert.deepEqual(s.restart, [], 'an action deliberately left without keys stays that way');
  assert.deepEqual(s.checkpoint, ['KeyZ'], 'a missing action gets its defaults');
  // A default never takes a key the player gave to something else.
  assert.deepEqual(sanitizeBindings({ jump: ['KeyP'] }).pause, []);
});

// ── Settings in the profile ─────────────────────────────────────────────────

test('settings: a save from before key remapping loads with the default keys', () => {
  const old = defaultProfile();
  const { keys: _keys, ...settings } = old.settings;
  const p = sanitizeProfile({ ...old, settings: { ...settings, master: 0.3, reducedMotion: true } });
  assert.deepEqual(p.settings.keys, defaultBindings());
  assert.equal(p.settings.master, 0.3);
  assert.equal(p.settings.reducedMotion, true);
});

test('settings: custom keys survive a save and load', () => {
  const mem = memory();
  const a = new ProfileStore(mem);
  a.updateSettings({ keys: bindKey(a.profile.settings.keys, 'jump', 0, 'KeyJ').bindings });
  a.flush();
  const b = new ProfileStore(mem);
  assert.deepEqual(b.profile.settings.keys.jump, ['KeyJ', 'ArrowUp', 'KeyW', 'KeyX']);
});

test('settings: every setting belongs to exactly one category', () => {
  const listed = Object.values(SETTINGS_SECTIONS).flat();
  assert.equal(new Set(listed).size, listed.length, 'no setting is listed twice');
  assert.deepEqual([...listed].sort(), Object.keys(defaultSettings()).sort());
});

test('settings: a category knows when it is at its defaults, and how to get back', () => {
  const s = defaultSettings();
  for (const id of Object.keys(SETTINGS_SECTIONS) as (keyof typeof SETTINGS_SECTIONS)[]) assert.equal(sectionIsDefault(s, id), true, id);
  const changed = { ...s, music: 0.2, keys: clearKey(s.keys, 'jump', 0) };
  assert.equal(sectionIsDefault(changed, 'audio'), false);
  assert.equal(sectionIsDefault(changed, 'gameplay'), false);
  assert.equal(sectionIsDefault(changed, 'video'), true);
  const restored = { ...changed, ...sectionValues(defaultSettings(), 'audio') };
  assert.equal(sectionIsDefault(restored, 'audio'), true);
  assert.equal(sectionIsDefault(restored, 'gameplay'), false, 'other categories are left alone');
  assert.deepEqual(Object.keys(sectionValues(s, 'access')).sort(), ['highContrast', 'reducedMotion']);
});

// ── Save data ───────────────────────────────────────────────────────────────

test('save check: each kind of bad file gets its own verdict', () => {
  const problem = (json: string) => { const c = checkSave(json); return c.ok ? 'ok' : c.problem; };
  assert.equal(problem(''), 'empty');
  assert.equal(problem('   \n'), 'empty');
  assert.equal(problem('{ not json'), 'not-json');
  assert.equal(problem('[1,2,3]'), 'not-a-save');
  assert.equal(problem('"hello"'), 'not-a-save');
  assert.equal(problem(JSON.stringify({ hello: 'world' })), 'not-a-save');
  assert.equal(problem(JSON.stringify({ version: 2 })), 'not-a-save', 'a version number alone is not a save');
  assert.equal(problem(JSON.stringify({ version: 1, levels: {} })), 'other-version');
  assert.equal(problem(JSON.stringify({ version: 3, levels: {} })), 'other-version');
  assert.equal(problem(' '.repeat(MAX_SAVE_CHARS + 1)), 'empty');
  assert.equal(problem(`{"version":2,"levels":{},"pad":"${'x'.repeat(MAX_SAVE_CHARS)}"}`), 'too-large');
  assert.equal(problem(JSON.stringify(defaultProfile())), 'ok');
});

test('save check: a good file is read without touching the current save', () => {
  const { store } = played();
  const before = store.profile;
  const check = checkSave(JSON.stringify(defaultProfile()));
  assert.ok(check.ok);
  assert.equal(check.summary.cleared, 0);
  assert.equal(store.profile, before);
  const mine = summarizeSave(store.profile);
  assert.equal(mine.cleared, 1);
  assert.equal(mine.shards, 2);
  assert.equal(mine.attempts, 1);
  assert.equal(mine.tracks, 5);
  assert.equal(isBlankSave(store.profile), false);
  assert.equal(isBlankSave(defaultProfile()), true);
});

test('save data: an export imports back unchanged', () => {
  const { store } = played();
  store.updateSettings({ sfx: 0.25, keys: bindKey(store.profile.settings.keys, 'restart', 0, 'KeyT').bindings });
  const file = store.exportSave();
  const other = new ProfileStore(memory());
  other.importSave(file);
  assert.deepEqual(other.profile.levels, store.profile.levels);
  assert.equal(other.profile.settings.sfx, 0.25);
  assert.deepEqual(other.profile.settings.keys.restart, ['KeyT']);
});

test('save data: a refused import changes nothing', () => {
  const { store, mem } = played();
  const before = store.profile;
  for (const bad of ['', '{ not json', JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, levels: {} })]) {
    assert.throws(() => store.importSave(bad));
  }
  assert.equal(store.profile, before);
  assert.equal(mem.data.has(BACKUP_KEY), false);
  assert.equal(store.restorePoint(), null);
});

test('save data: an import keeps the replaced save, and restoring swaps the two', () => {
  const { store } = played();
  store.importSave(JSON.stringify(defaultProfile()));
  assert.equal(store.profile.levels.genesis.completed, false);
  const point = store.restorePoint();
  assert.ok(point);
  assert.equal(point.reason, 'import');
  assert.equal(point.summary.cleared, 1);

  assert.equal(store.restorePrevious(), true);
  assert.equal(store.profile.levels.genesis.completed, true);
  assert.equal(store.profile.levels.genesis.shards, 0b011);
  // The imported save was blank, so there is nothing worth offering in exchange.
  assert.equal(store.restorePoint(), null);
  assert.equal(store.restorePrevious(), false);
});

test('save data: a reset can be undone, and keeps settings and keys', () => {
  const { store, mem } = played();
  store.updateSettings({ music: 0.1, keys: bindKey(store.profile.settings.keys, 'jump', 0, 'KeyJ').bindings });
  store.resetProgress();
  assert.equal(store.profile.levels.genesis.completed, false);
  assert.equal(store.profile.settings.music, 0.1);
  assert.equal(store.profile.settings.keys.jump[0], 'KeyJ');
  assert.equal(store.restorePoint()?.reason, 'reset');

  // The restore point is in storage, so it is still there on the next visit.
  const later = new ProfileStore(mem);
  assert.equal(later.profile.levels.genesis.completed, false);
  assert.equal(later.restorePoint()?.summary.cleared, 1);
  assert.equal(later.restorePrevious(), true);
  assert.equal(later.profile.levels.genesis.completed, true);
  assert.equal(JSON.parse(mem.data.get(STORAGE_KEY)!).levels.genesis.completed, true, 'the restored save is written at once');
});

test('save data: resetting twice does not push real progress out of the restore point', () => {
  const { store } = played();
  store.resetProgress();
  store.resetProgress();
  store.importSave(JSON.stringify(defaultProfile()));
  assert.equal(store.restorePoint()?.summary.cleared, 1);
  assert.equal(store.restorePrevious(), true);
  assert.equal(store.profile.levels.genesis.completed, true);
});

test('save data: restoring over real progress keeps that progress as the new restore point', () => {
  const { store } = played();
  store.resetProgress();
  store.beginAttempt('genesis', false);
  store.recordRun(run({ progress: 0.4 }));
  assert.equal(store.restorePrevious(), true);
  assert.equal(store.profile.levels.genesis.completed, true);
  const point = store.restorePoint();
  assert.equal(point?.reason, 'restore');
  assert.equal(point?.summary.cleared, 0);
  assert.equal(point?.summary.attempts, 1);
  assert.equal(store.restorePrevious(), true, 'and the restore can itself be undone');
  assert.equal(store.profile.levels.genesis.completed, false);
});

test('save data: a damaged restore point is ignored, and storage that refuses writes is survived', () => {
  const broken = new ProfileStore(memory({ [BACKUP_KEY]: '{ not json' }));
  assert.equal(broken.restorePoint(), null);
  assert.equal(broken.restorePrevious(), false);
  const wrong = new ProfileStore(memory({ [BACKUP_KEY]: JSON.stringify({ at: 1, reason: 'reset', profile: { hello: 'world' } }) }));
  assert.equal(wrong.restorePoint(), null);

  const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const store = new ProfileStore(full);
  store.beginAttempt('genesis', false);
  store.recordRun(run({ completed: true, progress: 1 }));
  assert.doesNotThrow(() => store.resetProgress());
  assert.equal(store.profile.levels.genesis.completed, false);
  assert.equal(store.restorePoint(), null);
  assert.equal(store.readOnly, true);
  assert.doesNotThrow(() => new ProfileStore(null).resetProgress());
});

test('save data: import and restore leave the news markers alone', () => {
  const { store } = played();
  const news = store.profile.news;
  store.importSave(JSON.stringify({ ...defaultProfile(), news: { viewed: [], notified: null } }));
  assert.deepEqual(store.profile.news, news);
  store.restorePrevious();
  assert.deepEqual(store.profile.news, news);
});
