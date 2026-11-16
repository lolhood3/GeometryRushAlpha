/**
 * Visual checks: walks the game in a headless browser at desktop and phone
 * sizes, takes a screenshot of every screen, dialog and moment of play, and
 * checks each one against rules a layout must never break:
 *
 *   - nothing was written to the browser console as an error or a warning;
 *   - the page never scrolls sideways;
 *   - every control is on the screen, or inside something that scrolls to it;
 *   - a dialog covers the whole screen, fits inside it, and its buttons can be reached;
 *   - during play the stage is actually being drawn.
 *
 *   npm run visual                     every size, every scene
 *   npm run visual -- --size phone     one size (desktop, phone, phone-small)
 *   npm run visual -- --only settings  only the scenes whose name contains this
 *   npm run visual -- --url http://localhost:5173/   use a dev server that is already running
 *   npm run visual -- --out some/dir   where the screenshots go (default visual-report)
 *
 * The screenshots and an index.html to look through them are written to the
 * output folder; the exit code is 1 when a rule was broken. Looking is still
 * part of the job: the rules catch what is off the screen, not what is ugly.
 *
 * It needs a Chrome or Chromium. One installed on the machine is found by
 * itself; otherwise point CHROME_PATH at one. CHROME_ARGS adds launch flags.
 * It runs against the development build, which is the one that lets a script
 * drive the game (window.__gr and window.__grUi).
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { fresh, mid } from './visual/profiles.mjs';

const { REPLAYS } = await import('../src/game/levels/replays.ts');
const { getLevel } = await import('../src/game/levels/index.ts');
const { encodeRun, runRef, runSignature } = await import('../src/game/replay/code.ts');

const SIZES = {
  desktop: { width: 1366, height: 768 },
  phone: { width: 844, height: 390, touch: true },
  'phone-small': { width: 667, height: 375, touch: true },
};
const SAVE_KEY = 'geometry_rush_v2_profile';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('only');
const outDir = resolve(opt('out') ?? 'visual-report');
const sizes = opt('size') ? [opt('size')] : Object.keys(SIZES);
for (const s of sizes) if (!SIZES[s]) { console.error(`No size called "${s}". There are: ${Object.keys(SIZES).join(', ')}.`); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const named = process.env.CHROME_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (named) return named;
  const places = [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return places.find((p) => existsSync(p));
}

// ── What is checked on every screenshot (runs in the page) ──────────────────
function audit(playing) {
  const problems = [];
  const W = innerWidth;
  const H = innerHeight;
  const name = (el) => {
    const text = (el.getAttribute('aria-label') ?? el.innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}${text ? ` "${text}"` : ''}`;
  };
  const shown = (el) => {
    if (el.closest('[aria-hidden="true"], [inert]')) return false;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const scrolls = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const st = getComputedStyle(p);
      if (/(auto|scroll)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 1) return true;
      if (/(auto|scroll)/.test(st.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };

  if (document.documentElement.scrollWidth > W + 1) problems.push(`the page scrolls sideways (${document.documentElement.scrollWidth} px wide in a ${W} px window)`);

  const scrim = [...document.querySelectorAll('.dialog-scrim')].find(shown);
  const scope = scrim ?? document;
  for (const el of scope.querySelectorAll('button, a[href], input, textarea, select, [role="tab"], [role="slider"]')) {
    if (!shown(el) || scrolls(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) {
      problems.push(`${name(el)} is partly off the screen (${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
  }
  if (scrim) {
    const s = scrim.getBoundingClientRect();
    if (Math.abs(s.left) > 1 || Math.abs(s.top) > 1 || Math.abs(s.width - W) > 1 || Math.abs(s.height - H) > 1) {
      problems.push(`the dialog backdrop covers ${Math.round(s.width)}×${Math.round(s.height)} at ${Math.round(s.left)},${Math.round(s.top)}, not the whole screen`);
    }
    const d = scrim.querySelector('.dialog');
    const r = d?.getBoundingClientRect();
    if (r && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)) problems.push('the dialog does not fit on the screen');
    for (const b of scrim.querySelectorAll('.dialog__actions button')) {
      const q = b.getBoundingClientRect();
      if (q.width > 1 && (q.top < r.top - 1 || q.bottom > Math.min(H, r.bottom) + 1)) problems.push(`dialog button ${name(b)} cannot be reached`);
    }
  }
  if (playing) {
    const g = window.__gr;
    if (!(g.live.instances > 0)) problems.push('nothing is being drawn on the stage');
  }
  return problems;
}

// ── Driving the game (development build only) ───────────────────────────────
const settle = (page) => page.waitForFunction(
  () => document.getAnimations().every((a) => !a.animationName || a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  { timeout: 8000, polling: 100 },
).catch(() => {});
const clickText = async (page, selector, text) => {
  const ok = await page.evaluate((selector, text) => {
    const el = [...document.querySelectorAll(selector)].find((e) => new RegExp(text, 'i').test(e.innerText) && !e.disabled);
    el?.click();
    return !!el;
  }, selector, text);
  if (!ok) throw new Error(`nothing matching "${text}" in ${selector}`);
  await sleep(500);
};
const back = async (page) => { await page.keyboard.press('Escape'); await sleep(700); };
/** Plays the stored reference run on the live game up to `beat`, then stops the frame so it can be looked at. */
const playTo = (page, id, beat) => page.evaluate((toggles, beat) => {
  const g = window.__gr;
  const s = g.sim;
  let i = 0;
  let held = false;
  while (!s.dead && !s.won && s.beat < beat) {
    while (i < toggles.length && toggles[i] <= s.tick) { held = !held; i++; }
    s.setInput(held);
    s.step();
  }
  s.events.length = 0;
  s.setInput(false);
  g.transport.start(g.song, s.tick / 240, 0);
  g.camera.follow(s.x, s.y, 0, true);
  return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => { g.loop.stop(); g.transport.stop(0); done(); })));
}, REPLAYS[id], beat);
const resume = (page) => page.evaluate(() => { const g = window.__gr; g.transport.start(g.song, g.sim.tick / 240, 0); g.loop.start(); });
const start = async (page, id, practice = false) => {
  await page.evaluate((id, practice) => window.__grUi.play(id, practice), id, practice);
  await page.waitForSelector('.hud', { timeout: 10000 });
  await sleep(900);
};
const leave = async (page) => {
  await page.evaluate(() => { window.__gr.loop.start(); window.__grUi.leave('menu'); });
  await page.waitForSelector('.menu-item', { timeout: 10000 });
  await sleep(900);
};
const runCode = () => {
  const level = getLevel('velocity');
  return encodeRun({ ref: runRef(level), sig: runSignature(level), ticks: 1_000_000, toggles: REPLAYS.velocity });
};

/**
 * The scenes, in the order they are visited. Each starts from the main menu
 * and must leave the game there. `shot(name, { playing })` takes the
 * screenshot and runs the checks.
 */
const SCENES = [
  ['menu', async (page, shot) => { await shot('menu'); }],
  ['levels', async (page, shot) => {
    await clickText(page, '.menu-item', 'levels'); await shot('levels');
    await clickText(page, 'button', 'race a run code'); await shot('levels-runcode-empty');
    await page.evaluate((code) => {
      const box = document.querySelector('.runcode__box');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, code);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }, runCode());
    await page.waitForSelector('.runcode__ok', { timeout: 20000 }); await shot('levels-runcode-checked');
    await back(page);
    await page.evaluate(() => document.querySelector('[data-challenges]')?.click()); await sleep(500); await shot('levels-challenges');
    await back(page); await back(page);
  }],
  ['garage', async (page, shot) => { await clickText(page, '.menu-item', 'garage'); await shot('garage'); await back(page); }],
  ['records', async (page, shot) => {
    await clickText(page, '.menu-item', 'records'); await shot('records');
    const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((t) => t.innerText.trim().split('\n')[0]));
    for (const [i, tab] of tabs.entries()) {
      if (i === 0) continue;
      await page.evaluate((i) => document.querySelectorAll('[role="tab"]')[i].click(), i); await sleep(600);
      const slug = tab.toLowerCase().replace(/[^a-z]+/g, '-');
      await shot(`records-${slug}`);
      const opened = await page.evaluate(() => { const el = document.querySelector('.ach, .trk__row:not(.trk__row--head)'); el?.click(); return !!el; });
      await sleep(500);
      if (opened && await page.$('.dialog')) { await shot(`records-${slug}-detail`); await back(page); }
    }
    await back(page);
  }],
  ['updates', async (page, shot) => { await clickText(page, '.menu-item', 'updates'); await shot('updates'); await back(page); }],
  ['settings', async (page, shot) => {
    await clickText(page, '.menu-item', 'settings');
    const panes = await page.evaluate(() => [...document.querySelectorAll('.set-nav__item')].map((t) => t.innerText.trim().split('\n').find((l) => /[a-z]{3}/i.test(l)) ?? ''));
    for (const [i, pane] of panes.entries()) {
      await page.evaluate((i) => document.querySelectorAll('.set-nav__item')[i].click(), i); await sleep(600);
      const slug = pane.toLowerCase().replace(/[^a-z]+/g, '-');
      await shot(`settings-${slug}`);
      if (/audio/i.test(pane)) {
        await clickText(page, 'button', '^calibrate$'); await sleep(400); await shot('settings-calibration'); await back(page);
      }
      if (/save/i.test(pane)) {
        await clickText(page, 'button', '^reset$'); await shot('settings-reset'); await back(page);
      }
    }
    await back(page);
  }],
  ['credits', async (page, shot) => { await clickText(page, '.menu-item', 'credits'); await shot('credits'); await back(page); }],
  ['play', async (page, shot) => {
    await start(page, 'genesis'); await playTo(page, 'genesis', 9); await shot('play-hud', { playing: true });
    await resume(page); await page.keyboard.press('Escape'); await page.waitForSelector('.pause__panel', { timeout: 8000 }); await shot('play-pause', { playing: true });
    await leave(page);
    // Nobody at the controls: the first spike ends the run.
    await start(page, 'genesis'); await page.waitForSelector('.death', { timeout: 30000 }); await sleep(900); await shot('play-crash', { playing: true });
    await leave(page);
    await start(page, 'genesis', true); await playTo(page, 'genesis', 20); await shot('play-practice', { playing: true });
    await leave(page);
  }],
  ['play-modes', async (page, shot) => {
    // A profile that has not opened these tracks can still be shown them: the script starts them directly.
    for (const [id, beat, what] of [['velocity', 40, 'ship'], ['overdrive', 66, 'mini'], ['quantum', 88, 'dual']]) {
      await start(page, id, true); await playTo(page, id, beat); await shot(`play-${id}-${what}`, { playing: true }); await leave(page);
    }
  }],
  ['results', async (page, shot) => {
    await start(page, 'genesis'); await playTo(page, 'genesis', 126.5); await resume(page);
    await page.waitForSelector('.results__panel', { timeout: 30000 }); await sleep(1500); await shot('results', { playing: true });
    await leave(page);
  }],
];

async function visit(browser, base, sizeName, report) {
  const size = SIZES[sizeName];
  const dir = join(outDir, sizeName);
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: size.touch ? 2 : 1, isMobile: !!size.touch, hasTouch: !!size.touch, isLandscape: true });
  const noise = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') noise.push(m.text().slice(0, 240)); });
  page.on('pageerror', (e) => noise.push(`page error: ${String(e).slice(0, 240)}`));

  const record = (name, problems) => {
    report.push({ size: sizeName, name, file: `${sizeName}/${name}.png`, problems });
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${sizeName.padEnd(11)} ${name}`);
    for (const p of problems) console.log(`       ${p}`);
  };
  const shot = async (name, o = {}) => {
    await settle(page);
    const problems = await page.evaluate(audit, !!o.playing);
    for (const n of noise.splice(0)) problems.push(`console: ${n}`);
    await page.screenshot({ path: join(dir, `${name}.png`) });
    record(name, problems);
  };
  const open = async (profile) => {
    await page.evaluateOnNewDocument((key, value) => {
      if (sessionStorage.getItem('visual-seeded')) return;
      sessionStorage.setItem('visual-seeded', '1');
      if (value) localStorage.setItem(key, value); else localStorage.removeItem(key);
    }, SAVE_KEY, profile ? JSON.stringify(profile) : null);
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector('.title', { timeout: 60000 });
    await sleep(1500);
  };
  const enter = async () => {
    for (let i = 0; i < 10 && !(await page.$('.menu-item')); i++) {
      if (size.touch) await page.touchscreen.tap(size.width / 2, size.height / 2); else await page.keyboard.press('Enter');
      await page.waitForSelector('.menu-item', { timeout: 2500 }).catch(() => {});
    }
    await page.waitForSelector('.menu-item', { timeout: 5000 });
    await sleep(1200);
  };
  const wanted = (name) => !only || name.includes(only);

  // A player part-way through the game.
  await open(mid);
  if (wanted('title')) await shot('title');
  await enter();
  for (const [name, scene] of SCENES) {
    if (!wanted(name)) continue;
    try {
      await scene(page, shot);
    } catch (e) {
      await page.screenshot({ path: join(dir, `${name}-stuck.png`) }).catch(() => {});
      record(`${name}-stuck`, [`the script could not get through this scene: ${String(e.message ?? e).split('\n')[0]}`, ...noise.splice(0).map((n) => `console: ${n}`)]);
      // Start again from a known place so one stuck scene does not take the rest with it.
      await page.goto(base, { waitUntil: 'load' }); await page.waitForSelector('.title', { timeout: 60000 }); await sleep(1500); await enter();
    }
  }

  // Somebody opening the game for the first time.
  if (wanted('first-run')) {
    await page.evaluate(() => sessionStorage.removeItem('visual-seeded'));
    await open(fresh);
    await enter();
    await shot('first-run-menu');
    await start(page, 'genesis');
    await sleep(1200);
    await shot('first-run-play', { playing: true });
    await leave(page);
  }

  // A phone held upright is asked to turn round.
  if (size.touch && wanted('upright')) {
    await page.setViewport({ width: size.height, height: size.width, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: false });
    await sleep(900);
    await shot('upright');
  }
  await page.close();
}

function writeIndex(report) {
  const rows = report.map((r) => `
    <figure class="${r.problems.length ? 'bad' : ''}">
      <a href="${r.file}"><img loading="lazy" src="${r.file}" alt=""></a>
      <figcaption><b>${r.size}</b> ${r.name}${r.problems.map((p) => `<span>${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</span>`).join('')}</figcaption>
    </figure>`).join('');
  writeFileSync(join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Geometry Rush · visual checks</title>
<style>body{margin:24px;background:#0b0e18;color:#dfe5f5;font:14px/1.4 system-ui,sans-serif}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:18px}
figure{margin:0;border:1px solid #2a3145;padding:8px}figure.bad{border-color:#ff3d71}img{width:100%;display:block}figcaption{padding-top:6px}b{color:#00e5ff;margin-right:6px}span{display:block;color:#ff8fa8;font-size:12.5px}</style>
<h1>Visual checks</h1><p>${report.length} screenshots, ${report.filter((r) => r.problems.length).length} with a broken rule.</p><main>${rows}</main>`);
}

// ── Run ─────────────────────────────────────────────────────────────────────
const chrome = findChrome();
if (!chrome) {
  console.error('No Chrome or Chromium was found. Install one, or set CHROME_PATH to its executable.');
  process.exit(2);
}
let server = null;
let base = opt('url');
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error', clearScreen: false });
  await server.listen();
  base = server.resolvedUrls.local[0];
}
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const root = typeof process.getuid === 'function' && process.getuid() === 0;
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: chrome, headless: 'shell',
    args: [
      // Software rendering: the same picture on every machine, and it works where there is no graphics card.
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--hide-scrollbars',
      ...(root || process.env.CI ? ['--no-sandbox'] : []),
      ...(process.env.CHROME_ARGS ?? '').split(/\s+/).filter(Boolean),
    ],
  });
} catch (e) {
  await server?.close();
  console.error(`The browser at ${chrome} did not start:\n${String(e.message ?? e).split('\n').slice(0, 6).join('\n')}`);
  process.exit(2);
}
const report = [];
let crashed = null;
try {
  for (const s of sizes) await visit(browser, base, s, report);
} catch (e) {
  crashed = e;
} finally {
  await browser.close();
  await server?.close();
}
writeIndex(report);
const broken = report.filter((r) => r.problems.length);
console.log(`\n${report.length} screenshots in ${outDir}${broken.length ? `, ${broken.length} with a broken rule` : ', every rule held'}. Open index.html there to look through them.`);
if (crashed) console.error(`\nThe run stopped early: ${crashed.stack ?? crashed}`);
process.exit(broken.length || crashed ? 1 : 0);
