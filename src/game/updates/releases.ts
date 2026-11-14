import type { Release } from './types.ts';

/**
 * The changelog, newest first. This file is the only place release notes live:
 * add an entry at the top and the Updates & News screen, the menu marker and
 * the What's New notice all pick it up.
 *
 * Rules: one entry per release that reached players; the first entry's version
 * must match package.json (checked by the tests); never rename a shipped `id`.
 */
export const RELEASES: readonly Release[] = [
  {
    id: 'v2-2-0',
    version: '2.2.0',
    title: 'Settings & Records Evolution',
    date: '2026-11-14',
    category: 'Minor Update',
    era: 'v2',
    description: 'Settings has been rebuilt around the same five categories, with keys you can rebind and save data that is much harder to lose by accident. Records is now a career page: your overall completion, a track table you can open, and an achievement collection with filters and full details.',
    features: [
      'Key remapping: bind Jump, Pause, Restart and Remove checkpoint to the keys you want, under Settings, Gameplay. Touch, mouse, gamepad and Esc stay as they are',
      'Restore point: the save replaced by an import or erased by a reset is kept in the browser and can be brought back from Save data',
      'Import preview: a save file is shown beside the save on this device before it replaces anything',
      'Restore defaults for each settings category, with undo',
      'Records, career: overall completion, the date you started, progress bars for levels, stars, shards, cosmetics and achievements, and three milestones (latest unlock, closest achievement, next track to clear)',
      'Records, achievements: filter by All, In Progress, Completed or Locked, and open any achievement for its exact requirements, your current progress, its reward and the date you completed it',
      'Records, tracks: open any track for its tempo, length, records and feats, and start it in Normal or Practice from there',
    ],
    improvements: [
      'Settings now has a category rail and groups related options under headings, and the scene behind it is dimmed so the rows are easier to read',
      'Sliders have minus and plus buttons, a mark at the default value and a clearer number; Sync offset fills outward from zero',
      'Each quality preset says what it does, and the current render resolution and frame rate are shown beside it',
      'Screen shake and Flashes show when Reduced motion is holding them off, and are also listed under Accessibility',
      'High contrast now brightens secondary text and outlines in every menu as well as backing the in-game text',
      'Resetting progress lists exactly what will be erased and needs the button held down',
      'Exported saves are named with the date, and a file that cannot be imported is refused with the reason',
      'Fullscreen is a switch that shows whether the game is in fullscreen; Vibration says when the browser cannot vibrate',
      'Prompts during a run name the key that is actually bound to jump',
      'Every achievement has its own emblem, and locked, in-progress and completed cards are told apart at a glance; rewards are shown on the card',
      'The track table marks your best sync and longest streak across tracks, and turns into a labelled list on narrow screens',
      'On-beat accuracy shows its rank on a scale from C to S',
      'A newly completed achievement is flagged in Records until you have seen it',
    ],
    fixes: [
      'Arrow keys and Tab no longer move the selection on the screen behind an open dialog',
      'The gamepad button in the controls list no longer shows as an empty box',
      'Achievement cards no longer show a bare number beside the counter: Locked In read "76" next to 19/25, which was the percentage without its sign',
      'Persistent and Relentless are granted on the attempt that reaches the target, and a save that already meets a requirement is granted it when the game loads, instead of both waiting for the next finished run',
      'Sync percentages are rounded down everywhere, so a 74.6% run no longer reads 75% beside a B rank',
    ],
  },
  {
    id: 'v2-1-1',
    version: '2.1.1',
    label: 'Hotfix 02',
    title: 'Landscape Only',
    date: '2026-11-14',
    category: 'Hotfix',
    era: 'v2',
    description: 'Phones now run Geometry Rush in landscape only. Held upright, the game is covered and frozen until the phone is turned.',
    features: [],
    improvements: [
      'Rotate for me: on browsers that allow it, one tap on the rotate notice goes fullscreen and turns the screen to landscape',
      'The game asks the phone to hold landscape whenever it goes fullscreen',
    ],
    fixes: [
      'The game can no longer be used on a phone held upright: every screen is covered by a rotate notice and takes no input',
      'Turning the phone upright mid-run pauses the run instead of letting it play on; resume it from the pause menu once the phone is sideways again',
      'The picture is measured again after a rotation, so nothing needs reloading',
      'Tablets, laptops and desktops are not restricted, whatever the shape of the window',
    ],
  },
  {
    id: 'v2-1-0',
    version: '2.1.0',
    title: 'Updates & News',
    date: '2026-11-14',
    category: 'Minor Update',
    era: 'v2',
    description: 'The release history is back. Every version of Geometry Rush, what changed in it and when, one step from the main menu.',
    features: [
      'Updates & News on the main menu: every release with its version, date, category and full notes',
      'What\'s New notice on the main menu after an update, shown once per release',
      'Unread markers on the menu entry and on releases you have not opened yet',
      'Archived notes for Update 1 and Update 1.1 of the original game, recovered from the project history',
    ],
    improvements: [
      'The build number in Credits now matches the version listed here',
    ],
    fixes: [],
  },
  {
    id: 'v2-0-1',
    version: '2.0.1',
    label: 'Hotfix 01',
    title: 'Music Playback',
    date: '2026-11-14',
    category: 'Hotfix',
    era: 'v2',
    description: 'Fixes the soundtrack staying silent when the browser had not started audio, or had stopped it, at the moment a screen changed.',
    features: [],
    improvements: [
      'A run pauses if audio is lost mid-level, so the track and the music cannot drift apart',
      'Music re-syncs to the level clock when audio comes back',
      'Asks for the playback audio session on browsers that offer one',
    ],
    fixes: [
      'Music now starts as soon as audio is available instead of being dropped for the rest of the screen',
      'Taps on a touch screen wake audio as reliably as a click or a key press',
      'Starting audio no longer hangs when the browser never answers',
      'Audio resumes from the interrupted state that phones report during calls and app switches',
      'A single note that fails to play no longer stalls the rest of the song',
    ],
  },
  {
    id: 'v2-0-0',
    version: '2.0.0',
    title: 'The Rebuild',
    date: '2026-11-14',
    category: 'Major Update',
    era: 'v2',
    description: 'Geometry Rush, rebuilt from the ground up on Rush Engine 2. New tracks, a soundtrack synthesised live, and everything locked to the beat.',
    features: [
      'Rush Engine 2: a WebGL 2 renderer and a deterministic 240 Hz simulation, both driven by the music clock',
      'Five new tracks from Easy to Insane: Genesis, Velocity, Overdrive, Quantum and Apex, 124 to 164 BPM',
      'Three vehicles: cube, ship and wave, with orbs, pads, gravity flips and speed gates',
      'A soundtrack written as data and synthesised at runtime, along with every sound effect',
      'Practice mode with checkpoints',
      'Three shards hidden in every track and 30 stars to earn',
      'Garage with 13 chassis, 12 paints and 6 trails to unlock',
      'Records screen with career stats and 20 achievements',
      'Sync tracking: an on-beat streak while you play and a sync rank for each track',
    ],
    improvements: [
      'Keyboard, mouse, touch and gamepad input',
      'Sync offset calibration for Bluetooth and other late audio',
      'Automatic render quality, reduced motion and a high-contrast HUD',
      'Save export and import in Settings',
      'Audio and display settings from the original game carry over, and pilots who cleared a track there unlock the Alpha chassis',
    ],
    fixes: [],
    sections: [
      {
        title: 'Not carried over',
        items: [
          'The original tracks, chassis and save progress',
          'Updates & News and the What\'s New notice, which return in 2.1.0',
          'Haptics intensity levels: vibration is now a single on/off setting',
        ],
      },
    ],
  },
  {
    id: 'update-1-1',
    version: '1.1.0',
    label: 'Update 1.1',
    title: 'Polish & Haptics',
    date: '2026-08',
    category: 'Improvement',
    era: 'original',
    description: 'Precision mobile controls, tactile haptic feedback matrix, and news hub.',
    features: [
      'Tactile Haptics Engine: physical vibration cues for jumps, landings, crashes, and victories',
      'Haptics customization in Settings with Low, Medium, and High intensity scaling',
      'Player-facing Updates & News terminal with complete patch logs',
      'Interactive "What\'s New" release highlights modal',
    ],
    improvements: [
      'Streamlined Pointer Events input pipeline for zero-latency touch response',
      'Refined responsive landscape layout across mobile phones and tablet viewports',
      'Fast instant respawn with sub-0.5s recovery cycle',
      'Smooth menu button transitions with tactile acoustic sync',
    ],
    fixes: [
      'Isolated game canvas pointer capture so HUD and menu overlays respond cleanly to touch',
      'Eliminated unwanted browser scrolling and pull-to-refresh conflicts in landscape',
      'Resolved potential touch cancel gesture dropping on device edge swipes',
    ],
  },
  {
    id: 'update-1-0',
    version: '1.0.0',
    label: 'Update 1',
    title: 'The First Run',
    date: '2026-08',
    category: 'Major Update',
    era: 'original',
    description: 'Geometry Rush initial release with 5 gauntlet tracks, 130 BPM procedural synth audio, and customizable chassis.',
    features: [
      'Rush Engine 2D with 60Hz deterministic physics and Continuous Collision Detection',
      '5 Handcrafted precision gauntlets: Genesis, Neon Drift, Cyber Pulse, Orbital Leap, Void Runner',
      '6 Quantum chassis skins with custom particle trails and colorways',
      'Procedural 130 BPM dynamic synth music matrix with procedural arpeggiator',
      'Cross-platform controls supporting Keyboard, Mouse, and Touch',
      'Full-featured Settings screen with audio balance, visual quality, and accessibility controls',
    ],
    improvements: [
      'Frame-accurate jump buffering and coyote time for crisp jumping mechanics',
      'Live 60 FPS performance monitoring and cross-platform developer diagnostics [F3]',
      'Automated landscape orientation enforcer for mobile devices',
    ],
    fixes: [],
  },
];

/**
 * First release whose save data records what the player has read. A save with
 * no news state was written by an older build, so everything before this
 * release counts as already seen and only this one (and later) is new.
 */
export const FIRST_TRACKED_RELEASE = 'v2-1-0';
