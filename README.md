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
```

Run `npm run replays` after changing a level or the simulation. It fails if a
level can no longer be completed with all three shards.

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

## Layout

- `src/engine/` — WebGL2 renderer, particles, input, loop, Web Audio synth and sequencer, and the landscape-only gate (`orientation.ts`).
- `src/game/sim/` — deterministic 240 Hz simulation and the level-building DSL.
- `src/game/levels/` — the five tracks and their generated reference replays.
- `src/game/music/` — the soundtrack, written as data and synthesised at runtime.
- `src/game/progression/` — save profile, key bindings (`keys.ts`), cosmetics, achievements, and the read-only views the Records screen is built from (`career.ts`, `achievementInfo.ts`).
- `src/game/updates/` — the changelog behind Updates & News and the What's New notice.
- `src/game/render/` — themes, camera, world, player and effects drawing.
- `src/game/dev/` — solver and verifier used by the tests and `npm run replays`.
- `src/ui/` — Preact screens, components and styles.
