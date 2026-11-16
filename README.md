# Geometry Rush V.2

A one-button rhythm platformer: five handcrafted tracks, three vehicles,
everything locked to the beat. Built on Rush Engine 2, with all music and sound
synthesised at runtime.

Created by Ankan Barik.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ on :4173
npm test           # simulation, level and progression tests
npm run replays    # re-verify every level and regenerate src/game/levels/replays.ts
npm run remixes    # find the part orders the Daily Remix may use; writes src/game/levels/remixes.ts
npm run level      # check, export or describe tracks written as JSON (see "Tracks as data")
npm run visual     # screenshots of every screen at desktop and phone sizes, with layout checks
```

Run `npm run replays` after changing a level or the simulation. It fails if a
level can no longer be completed with all three shards. Then run
`npm run remixes`: the Daily Remix replays parts of the reference runs, so its
stored orders have to be checked against the new ones.

## Releasing

Release notes live in `src/game/updates/releases.ts` and nowhere else. To ship a
version, bump `version` in `package.json` and add an entry at the top of
`RELEASES` with the same version. The Updates & News screen, the menu marker and
the What's New notice follow from that entry; `npm test` fails if the two
versions disagree.

## Controls

| Action | Keyboard | Touch / mouse | Gamepad |
| --- | --- | --- | --- |
| Jump / fly / hold | Space, ↑, W, X | Tap or hold anywhere | A, B, D-pad up |
| Pause / resume | Esc, P | Pause button | |
| Restart | R | Pause menu | |
| Remove checkpoint (practice) | Z | Button, bottom left | |

The keyboard column lists the defaults. Each of the four actions can be rebound under
Settings, Gameplay; a key belongs to one action at a time. Esc always pauses and goes back,
and Enter, Tab, Alt, Backspace, Delete and the function keys cannot be bound. Touch, mouse
and gamepad input is fixed.

## Save data

Progress and settings live in `localStorage` under `geometry_rush_v2_profile`. Settings, Save
data can export that save to a file and import one back; an import is shown beside the
current save before it replaces anything. The save replaced by an import, or erased by a
reset, is kept under `geometry_rush_v2_profile_backup` as a single restore point.

## Practice from a part

Each track is divided into the parts of its song. `src/game/levels/route.ts` plays the
level's reference replay once and keeps, for every part, a calm moment of that run shortly
before the part begins; a practice run from a part starts on that snapshot with its counters
cleared. The same pass measures the breakdown shown on the level select (vehicles, gravity
flips, speed range), so none of it is declared by hand. A run that starts part-way never
counts as a Practice clear.

## Daily Remix

Each day one track is cut into the parts of its song and rebuilt in another
order, with the song rearranged the same way (`src/game/levels/remix.ts`,
`daily.ts`). Nothing is downloaded: the date picks the track and the order, so
everyone gets the same remix on the same day. Only orders listed in
`src/game/levels/remixes.ts` are used. `npm run remixes` stores an order when
the rearranged reference run clears it with all shards and the solver clears
it inside the track's timing budget. The remix has its own record in the save
(`daily`), gives no stars or shards, and counts a streak of days cleared.

## Install and offline play

`npm run build` writes `dist/sw.js` from the template in `src/pwa/sw.js`, filled in with the
list of built files and a fingerprint of their contents. The service worker saves the page,
script, styles, icons and Latin fonts on first load, serves hashed files from that copy, and
fetches the page itself from the network first so a new build is picked up when online. A
new build replaces the saved copy once every open copy of the game has been closed. It is
registered in production builds only, and browsers require HTTPS (or localhost) for it.
`public/manifest.webmanifest` asks for fullscreen and landscape when installed. All paths
are relative, so the game can be hosted in any folder.

## Phones are landscape only

On a phone held upright the whole app is covered by a rotate notice and switched off: the
frame loop stops, input is swallowed, audio is suspended, and a run in progress is paused.
Turning the phone sideways lifts the notice and re-measures the canvas, with no reload. A
paused run waits in the pause menu.

A phone is a touch device whose shortest screen side is under 600 CSS px
(`PHONE_MAX_SHORT_SIDE` in `src/engine/orientation.ts`). Tablets, laptops and desktops are
never restricted, whatever the window shape. Where the browser has the Screen Orientation
API the game also asks for a landscape lock on the first tap, on entering fullscreen, and
from the "Rotate for me" button, but nothing depends on that request being granted.

## Tracks as data

A track can be written as a JSON document instead of TypeScript. A document is
a description (`meta`), an optional list of speed changes, the beat the track
ends at, and a list of steps. Each step is one call of the level builder with
its arguments named, and positions are in beats:

```json
{ "op": "spikes", "beat": 4.5, "n": 2 }
```

`levels/example.json` is a small complete one.

```bash
npm run level -- ops                         # every step and its arguments
npm run level -- check levels/example.json   # is it valid, and can it be cleared?
npm run level -- export genesis              # write a built-in track as a document
npm run level -- export all --out some/dir
```

`check` first reads the document and lists every mistake with its place in the
file and, where it can, what was probably meant. Then it runs the checks the
built-in tracks pass: exactly three shards, a song that exists at the track's
tempo, a player who never presses must not win, and the solver must find a run
that clears it with all three shards and still clears when every press is
moved a little early and a little late. When that fails it says how far the
search got, which is where to look. `--jitter` and `--nodes` change the
tolerance and the size of the search; `--replay out.json` saves the run found.
The exit code is 1 when anything is wrong.

To play a document, start `npm run dev` and open
`http://localhost:5173/?level=/levels/example.json`. It starts in Practice
under the id `playtest`, and nothing done on it is saved. This works in the
development build only.

The five tracks are still built from `src/game/levels/*.ts`; `export` writes
them out as documents that build the identical level, as worked examples. The
format lives in `src/game/levels/format.ts` and the checks in
`src/game/dev/check.ts`.

## Run codes

After a Normal run that reaches the end, the results screen has **Copy run
code**. The code (`GR2.` and then letters and digits) holds which track it was
and when the button went down and up, nothing else. **Levels → Race a run
code** takes a pasted code, replays those presses in the simulation and shows
the result that comes out, so a code cannot claim more than the run did. A
checked run can be raced: it appears on the track as an outline beside you.
Your own best run is never drawn while you play; after a clear, **Watch best
run** on the results screen plays it back. A code is tied to the exact layout it was made on, and one for
a Daily Remix to its day. The format is in `src/game/replay/code.ts`.

## Sync and frame rate

**Sync calibration** (Settings → Audio) plays a click and asks for 14 taps.
The taps are treated as points on a circle, so a cluster is found wherever it
lies; that is what lets it measure the 200 to 400 ms that wireless audio can
add (`src/game/calibration.ts`). The offset setting runs from -150 to +400 ms.

**Frame rate** is kept by two governors in `src/engine/budget.ts`. One thins
particles when frames run long and brings them back when there is room; it
works at every quality setting. The skyline and stars are not part of it: they
follow the Quality setting only, so the backdrop never changes mid-run. The other, on Auto only,
lowers the render resolution after effects have given what they can, and
raises it again later. Both go back to full quality if cutting changes
nothing, as on a display held at 30 frames a second. The FPS readout (Settings
→ Video) shows the current share of effects.

## Visual checks

```bash
npm run visual                      # every size, every scene
npm run visual -- --size phone      # desktop, phone or phone-small
npm run visual -- --only settings   # scenes whose name contains this
```

The script starts the development server, walks the game in a headless
browser, and writes a screenshot of every screen, dialog and moment of play to
`visual-report/`, with an `index.html` to look through them. On each one it
checks that nothing was logged as an error, the page does not scroll sideways,
every control is on the screen or inside something that scrolls to it, a
dialog covers and fits the screen with its buttons in reach, and the stage is
being drawn. The exit code is 1 when a rule is broken.

It needs Chrome or Chromium. An installed one is found by itself; otherwise
set `CHROME_PATH`. It does not compare against stored pictures, so looking
through the report is still part of the job. A full run is about 100
screenshots.

## Layout

- `src/engine/` — WebGL2 renderer, particles, input, loop, Web Audio synth and sequencer, and the landscape-only gate (`orientation.ts`).
- `src/game/sim/` — deterministic 240 Hz simulation and the level-building DSL.
- `src/game/levels/` — the five tracks, their generated reference replays, and the route read from them (`route.ts`: parts, vehicles, section starts).
- `src/game/onboarding.ts` — the guided intro shown over the opening of the first track.
- `src/game/music/` — the soundtrack, written as data and synthesised at runtime.
- `src/game/progression/` — save profile, key bindings (`keys.ts`), cosmetics, achievements, and the read-only views the Records screen is built from (`career.ts`, `achievementInfo.ts`).
- `src/game/updates/` — the changelog behind Updates & News and the What's New notice.
- `src/game/render/` — themes, camera, world, player and effects drawing.
- `src/game/dev/` — solver and verifier used by the tests and `npm run replays`, the checks behind `npm run level` (`check.ts`), and play-testing a document (`playtest.ts`).
- `src/game/replay/` — run codes.
- `scripts/` — the command-line tools above; `levels/` holds track documents.
- `src/ui/` — Preact screens, components and styles.
- `src/pwa/sw.js` — service worker template; `public/` holds the web manifest and icons.
