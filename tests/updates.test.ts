import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { STORAGE_KEY, defaultProfile, sanitizeProfile } from '../src/game/progression/profile.ts';
import { ProfileStore } from '../src/game/progression/store.ts';
import {
  CATEGORY_KEYS, ERAS, LATEST_RELEASE, RELEASES, caughtUpNews, formatReleaseDate, pendingNotice, releaseSections,
  sanitizeNews, unreadReleases, untrackedNews,
} from '../src/game/updates/index.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}
/** A save as builds before 2.1.0 wrote it: a valid profile with no news state. */
function oldSave(): string {
  const { news: _news, ...rest } = defaultProfile();
  return JSON.stringify(rest);
}
/** How many releases such a save has not seen: 2.1.0, where tracking began, and everything since. */
const owed = () => unreadReleases(untrackedNews()).length;
const semver = (v: string) => v.split('.').map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

test('changelog: every release is complete and well formed', () => {
  assert.ok(RELEASES.length > 0);
  assert.equal(new Set(RELEASES.map((r) => r.id)).size, RELEASES.length, 'ids are unique');
  assert.equal(new Set(RELEASES.map((r) => r.version)).size, RELEASES.length, 'versions are unique');
  for (const r of RELEASES) {
    assert.match(r.id, /^[a-z0-9-]{1,47}$/, r.id);
    assert.match(r.version, /^\d+\.\d+\.\d+$/, r.id);
    assert.match(r.date, /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/, r.id);
    assert.ok(r.title.trim() && r.description.trim(), r.id);
    assert.ok(r.category in CATEGORY_KEYS, r.id);
    assert.ok(ERAS.some((e) => e.id === r.era), r.id);
    const sections = releaseSections(r);
    assert.ok(sections.length > 0, `${r.id} has notes`);
    for (const s of sections) for (const item of s.items) assert.ok(item.trim(), `${r.id}: empty note`);
  }
});

test('changelog: newest first, and the newest is the build being shipped', () => {
  for (let i = 1; i < RELEASES.length; i++) {
    assert.ok(newer(RELEASES[i - 1].version, RELEASES[i].version), `${RELEASES[i - 1].version} > ${RELEASES[i].version}`);
    assert.ok(RELEASES[i - 1].date.slice(0, 7) >= RELEASES[i].date.slice(0, 7), 'dates do not run backwards');
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(LATEST_RELEASE.version, pkg.version, 'add a release entry when bumping package.json');
});

test('changelog: sections and dates', () => {
  const hotfix = RELEASES.find((r) => r.category === 'Hotfix')!;
  assert.deepEqual(releaseSections(hotfix).map((s) => s.title), ['Improvements', 'Bug Fixes'], 'empty sections are left out');
  const extra = RELEASES.find((r) => r.sections?.length)!;
  assert.equal(releaseSections(extra).at(-1)!.kind, 'extra');
  assert.equal(formatReleaseDate('2026-11-14'), '14 Nov 2026');
  assert.equal(formatReleaseDate('2026-11-04', true), '4 November 2026');
  assert.equal(formatReleaseDate('2026-08'), 'Aug 2026');
});

test('news state: a new player has nothing to catch up on', () => {
  assert.equal(pendingNotice(caughtUpNews()), null);
  assert.deepEqual(unreadReleases(caughtUpNews()), []);
  const store = new ProfileStore(memory());
  assert.equal(store.pendingNews(), null);
  assert.equal(store.unreadNews().length, 0);
});

test('news state: a save from before Updates & News is owed exactly the releases it has not seen', () => {
  const state = untrackedNews();
  assert.equal(pendingNotice(state), LATEST_RELEASE);
  assert.ok(unreadReleases(state).length >= 1);
  assert.ok(unreadReleases(state).every((r) => newer(r.version, '2.0.1')), 'older releases are not presented as new');
  assert.deepEqual(sanitizeProfile(JSON.parse(oldSave())).news, state);
});

test('news state: malformed data is repaired', () => {
  assert.deepEqual(sanitizeNews('nope'), untrackedNews());
  assert.deepEqual(sanitizeNews({ viewed: ['a', 'a', 7, null, 'x'.repeat(80)], notified: 12 }), { viewed: ['a'], notified: null });
  assert.equal(pendingNotice({ viewed: [], notified: 'a-release-that-no-longer-exists' }), LATEST_RELEASE);
});

test('store: the notice is shown once and stays gone after a reload', () => {
  const mem = memory({ [STORAGE_KEY]: oldSave() });
  const store = new ProfileStore(mem);
  assert.equal(store.pendingNews(), LATEST_RELEASE);
  store.acknowledgeNews();
  assert.equal(store.pendingNews(), null);
  assert.equal(store.unreadNews()[0], LATEST_RELEASE, 'dismissing the notice does not mark the notes as read');
  store.flush();
  const again = new ProfileStore(mem);
  assert.equal(again.pendingNews(), null);
  assert.equal(again.unreadNews().length, owed());
});

test('store: opening a release marks it read, and reading the latest settles the notice', () => {
  const mem = memory({ [STORAGE_KEY]: oldSave() });
  const store = new ProfileStore(mem);
  store.markReleaseViewed('not-a-release');
  assert.equal(store.unreadNews().length, owed());
  store.markReleaseViewed(LATEST_RELEASE.id);
  store.markReleaseViewed(LATEST_RELEASE.id);
  assert.equal(store.unreadNews().length, owed() - 1);
  assert.equal(store.pendingNews(), null);
  assert.equal(store.profile.news.viewed.filter((id) => id === LATEST_RELEASE.id).length, 1);
  store.flush();
  assert.equal(new ProfileStore(mem).unreadNews().length, owed() - 1);
});

test('store: resetting progress or importing a backup does not bring old news back', () => {
  const store = new ProfileStore(memory({ [STORAGE_KEY]: oldSave() }));
  store.acknowledgeNews();
  for (const r of RELEASES) store.markReleaseViewed(r.id);
  store.resetProgress();
  assert.equal(store.pendingNews(), null);
  assert.equal(store.unreadNews().length, 0);
  store.importSave(oldSave());
  assert.equal(store.pendingNews(), null);
  assert.equal(store.unreadNews().length, 0);
});
