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

## Controls

| Action | Keyboard | Touch / mouse | Gamepad |
| --- | --- | --- | --- |
| Jump / fly / hold | Space, ↑, W, X | Tap or hold anywhere | A, B, D-pad up |
| Pause / resume | Esc, P | Pause button | |
| Restart | R | Pause menu | |
| Remove checkpoint (practice) | Z | Button, bottom left | |

## Layout

- `src/engine/` — WebGL2 renderer, particles, input, loop, Web Audio synth and sequencer.
- `src/game/sim/` — deterministic 240 Hz simulation and the level-building DSL.
- `src/game/levels/` — the five tracks and their generated reference replays.
- `src/game/music/` — the soundtrack, written as data and synthesised at runtime.
- `src/game/progression/` — save profile, cosmetics, achievements.
- `src/game/render/` — themes, camera, world, player and effects drawing.
- `src/game/dev/` — solver and verifier used by the tests and `npm run replays`.
- `src/ui/` — Preact screens, components and styles.
