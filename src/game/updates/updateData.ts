import type { GameUpdate } from './updateTypes.ts';

/**
 * Ordered list of Geometry Rush updates (newest first).
 * Player facing numbering strictly adheres to "UPDATE 1", "UPDATE 1.1", "UPDATE 1.2", "UPDATE 2", etc.
 */
export const GAME_UPDATES: GameUpdate[] = [
  {
    id: 'update-1-1',
    version: '1.1.0',
    playerFacingVersion: 'UPDATE 1.1',
    title: 'POLISH & HAPTICS',
    date: 'August 2026',
    summary: 'Precision mobile controls, tactile haptic feedback matrix, and news hub.',
    category: 'Improvement',
    featured: true,
    changes: [
      {
        title: "WHAT'S NEW",
        items: [
          'Tactile Haptics Engine: physical vibration cues for jumps, landings, crashes, and victories',
          'Haptics customization in Settings with Low, Medium, and High intensity scaling',
          'Player-facing Updates & News terminal with complete patch logs',
          'Interactive "What\'s New" release highlights modal',
        ],
      },
      {
        title: 'IMPROVEMENTS',
        items: [
          'Streamlined Pointer Events input pipeline for zero-latency touch response',
          'Refined responsive landscape layout across mobile phones and tablet viewports',
          'Fast instant respawn with sub-0.5s recovery cycle',
          'Smooth menu button transitions with tactile acoustic sync',
        ],
      },
      {
        title: 'FIXES',
        items: [
          'Isolated game canvas pointer capture so HUD and menu overlays respond cleanly to touch',
          'Eliminated unwanted browser scrolling and pull-to-refresh conflicts in landscape',
          'Resolved potential touch cancel gesture dropping on device edge swipes',
        ],
      },
    ],
  },
  {
    id: 'update-1-0',
    version: '1.0.0',
    playerFacingVersion: 'UPDATE 1',
    title: 'THE FIRST RUN',
    date: 'August 2026',
    summary: 'Geometry Rush initial release with 5 gauntlet tracks, 130 BPM procedural synth audio, and customizable chassis.',
    category: 'Major Update',
    featured: false,
    changes: [
      {
        title: "WHAT'S NEW",
        items: [
          'Rush Engine 2D with 60Hz deterministic physics and Continuous Collision Detection',
          '5 Handcrafted precision gauntlets: Genesis, Neon Drift, Cyber Pulse, Orbital Leap, Void Runner',
          '6 Quantum chassis skins with custom particle trails and colorways',
          'Procedural 130 BPM dynamic synth music matrix with procedural arpeggiator',
          'Cross-platform controls supporting Keyboard, Mouse, and Touch',
          'Full-featured Settings screen with audio balance, visual quality, and accessibility controls',
        ],
      },
      {
        title: 'IMPROVEMENTS',
        items: [
          'Frame-accurate jump buffering and coyote time for crisp jumping mechanics',
          'Live 60 FPS performance monitoring and cross-platform developer diagnostics [F3]',
          'Automated landscape orientation enforcer for mobile devices',
        ],
      },
    ],
  },
];
