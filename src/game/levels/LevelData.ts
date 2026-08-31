export interface PlatformDef {
  x: number;
  y: number;
  width: number;
  height?: number;
}

export interface SpikeDef {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface GroundSectionDef {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelData {
  id: string;
  name: string;
  subtitle: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master';
  difficultyRank: 1 | 2 | 3 | 4 | 5;
  accentColor: string;
  lengthMeters: number;
  groundY: number;
  groundHeight: number;
  playerStart: {
    x: number;
    y: number;
  };
  groundSections: GroundSectionDef[];
  platforms: PlatformDef[];
  spikes: SpikeDef[];
  goal: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/* =========================================================================
 * LEVEL 1: GENESIS (Tutorial & Core Fundamentals)
 * ========================================================================= */
export const LEVEL_1_GENESIS: LevelData = {
  id: 'level-1-genesis',
  name: 'Level 1: Genesis',
  subtitle: 'Calibrate reflexes & master the jump arc',
  difficulty: 'Easy',
  difficultyRank: 1,
  accentColor: '#00E5FF',
  lengthMeters: 6150,
  groundY: 420,
  groundHeight: 140,
  playerStart: { x: 120, y: 388 },
  groundSections: [
    { x: 0, y: 420, width: 3550, height: 140 },
    { x: 4450, y: 420, width: 2200, height: 140 },
  ],
  platforms: [
    { x: 2050, y: 355, width: 220, height: 20 },
    { x: 2750, y: 355, width: 340, height: 20 },
    { x: 3200, y: 320, width: 180, height: 20 },
    { x: 3520, y: 360, width: 160, height: 20 },
    { x: 3780, y: 300, width: 180, height: 20 },
    { x: 4060, y: 340, width: 170, height: 20 },
    { x: 4320, y: 375, width: 180, height: 20 },
    { x: 4800, y: 345, width: 240, height: 20 },
    { x: 5160, y: 285, width: 220, height: 20 },
    { x: 5500, y: 345, width: 260, height: 20 },
  ],
  spikes: [
    { x: 1050, y: 390, width: 28, height: 30 },
    { x: 1540, y: 390, width: 28, height: 30 },
    { x: 1568, y: 390, width: 28, height: 30 },
    { x: 2420, y: 390, width: 28, height: 30 },
    { x: 2900, y: 325, width: 28, height: 30 },
    { x: 3700, y: 520, width: 30, height: 30 },
    { x: 3950, y: 520, width: 30, height: 30 },
    { x: 4200, y: 520, width: 30, height: 30 },
    { x: 4650, y: 390, width: 28, height: 30 },
    { x: 4900, y: 315, width: 28, height: 30 },
    { x: 5250, y: 255, width: 28, height: 30 },
    { x: 5600, y: 315, width: 28, height: 30 },
    { x: 5880, y: 390, width: 28, height: 30 },
    { x: 5908, y: 390, width: 28, height: 30 },
  ],
  goal: { x: 6150, y: 330, width: 44, height: 90 },
};

/* =========================================================================
 * LEVEL 2: VELOCITY (Rhythm Hops & Elevation Switches)
 * ========================================================================= */
export const LEVEL_2_VELOCITY: LevelData = {
  id: 'level-2-velocity',
  name: 'Level 2: Velocity',
  subtitle: 'Rhythmic triple hops and fast runway transitions',
  difficulty: 'Medium',
  difficultyRank: 2,
  accentColor: '#38BDF8',
  lengthMeters: 7600,
  groundY: 420,
  groundHeight: 140,
  playerStart: { x: 120, y: 388 },
  groundSections: [
    { x: 0, y: 420, width: 2400, height: 140 },
    { x: 3200, y: 420, width: 2200, height: 140 },
    { x: 6000, y: 420, width: 2000, height: 140 },
  ],
  platforms: [
    // Elevated bridge over first gap
    { x: 2350, y: 360, width: 220, height: 20 },
    { x: 2650, y: 310, width: 240, height: 20 },
    { x: 2980, y: 360, width: 220, height: 20 },

    // Middle high-rise sequence
    { x: 3600, y: 340, width: 300, height: 20 },
    { x: 4100, y: 280, width: 260, height: 20 },
    { x: 4500, y: 340, width: 220, height: 20 },
    { x: 4900, y: 370, width: 280, height: 20 },

    // Stepping over second gap
    { x: 5350, y: 340, width: 180, height: 20 },
    { x: 5600, y: 290, width: 190, height: 20 },
    { x: 5880, y: 350, width: 180, height: 20 },

    // Final sprint platforms
    { x: 6400, y: 340, width: 220, height: 20 },
    { x: 6750, y: 280, width: 240, height: 20 },
    { x: 7100, y: 340, width: 220, height: 20 },
  ],
  spikes: [
    // Intro rhythm warm-up
    { x: 850, y: 390, width: 28, height: 30 },
    { x: 1300, y: 390, width: 28, height: 30 },
    { x: 1328, y: 390, width: 28, height: 30 },
    { x: 1750, y: 390, width: 28, height: 30 },
    { x: 1778, y: 390, width: 28, height: 30 },
    { x: 1806, y: 390, width: 28, height: 30 }, // Triple spike

    // Gap 1 spikes
    { x: 2750, y: 280, width: 28, height: 30 }, // on middle bridge

    // Ground spikes after gap 1
    { x: 3350, y: 390, width: 28, height: 30 },
    { x: 3720, y: 310, width: 28, height: 30 }, // on platform
    { x: 4200, y: 250, width: 28, height: 30 }, // on high platform
    { x: 5000, y: 340, width: 28, height: 30 }, // on descending platform

    // Final section hazard sprint
    { x: 6200, y: 390, width: 28, height: 30 },
    { x: 6500, y: 310, width: 28, height: 30 },
    { x: 6850, y: 250, width: 28, height: 30 },
    { x: 7300, y: 390, width: 28, height: 30 },
    { x: 7328, y: 390, width: 28, height: 30 },
  ],
  goal: { x: 7550, y: 330, width: 44, height: 90 },
};

/* =========================================================================
 * LEVEL 3: OVERDRIVE (Chasm Leaps & Precision Gaps)
 * ========================================================================= */
export const LEVEL_3_OVERDRIVE: LevelData = {
  id: 'level-3-overdrive',
  name: 'Level 3: Overdrive',
  subtitle: 'Master coyote timing and deep chasm crossings',
  difficulty: 'Hard',
  difficultyRank: 3,
  accentColor: '#F59E0B',
  lengthMeters: 8900,
  groundY: 420,
  groundHeight: 140,
  playerStart: { x: 120, y: 388 },
  groundSections: [
    { x: 0, y: 420, width: 1800, height: 140 },
    { x: 3100, y: 420, width: 1600, height: 140 },
    { x: 5800, y: 420, width: 1400, height: 140 },
    { x: 7800, y: 420, width: 1500, height: 140 },
  ],
  platforms: [
    // Massive Chasm 1 (1800 -> 3100)
    { x: 1750, y: 370, width: 180, height: 20 },
    { x: 2050, y: 320, width: 160, height: 20 },
    { x: 2330, y: 270, width: 160, height: 20 },
    { x: 2600, y: 310, width: 170, height: 20 },
    { x: 2870, y: 360, width: 180, height: 20 },

    // Middle Tech Run (3100 -> 4700)
    { x: 3400, y: 350, width: 220, height: 20 },
    { x: 3800, y: 290, width: 200, height: 20 },
    { x: 4200, y: 240, width: 220, height: 20 },
    { x: 4550, y: 310, width: 200, height: 20 },

    // Massive Chasm 2 (4700 -> 5800)
    { x: 4850, y: 360, width: 160, height: 20 },
    { x: 5120, y: 310, width: 160, height: 20 },
    { x: 5400, y: 260, width: 170, height: 20 },
    { x: 5670, y: 330, width: 170, height: 20 },

    // Sky Bridge Chasm 3 (7200 -> 7800)
    { x: 7150, y: 360, width: 160, height: 20 },
    { x: 7380, y: 300, width: 150, height: 20 },
    { x: 7610, y: 350, width: 160, height: 20 },

    // Final Ascent
    { x: 8100, y: 350, width: 200, height: 20 },
    { x: 8400, y: 290, width: 220, height: 20 },
  ],
  spikes: [
    // Ground spike gauntlet
    { x: 700, y: 390, width: 28, height: 30 },
    { x: 1050, y: 390, width: 28, height: 30 },
    { x: 1078, y: 390, width: 28, height: 30 },
    { x: 1400, y: 390, width: 28, height: 30 },
    { x: 1428, y: 390, width: 28, height: 30 },

    // Chasm 1 platform spikes
    { x: 2110, y: 290, width: 28, height: 30 },
    { x: 2670, y: 280, width: 28, height: 30 },

    // Middle section precision spikes
    { x: 3250, y: 390, width: 28, height: 30 },
    { x: 3500, y: 320, width: 28, height: 30 },
    { x: 3900, y: 260, width: 28, height: 30 },
    { x: 4300, y: 210, width: 28, height: 30 },

    // Chasm 2 mid-air spike check
    { x: 5180, y: 280, width: 28, height: 30 },
    { x: 5460, y: 230, width: 28, height: 30 },

    // Ground 3 & 4 challenges
    { x: 6050, y: 390, width: 28, height: 30 },
    { x: 6350, y: 390, width: 28, height: 30 },
    { x: 6378, y: 390, width: 28, height: 30 },
    { x: 6700, y: 390, width: 28, height: 30 },
    { x: 7440, y: 270, width: 28, height: 30 }, // Sky bridge spike
    { x: 8200, y: 320, width: 28, height: 30 },
    { x: 8500, y: 260, width: 28, height: 30 },
    { x: 8700, y: 390, width: 28, height: 30 },
    { x: 8728, y: 390, width: 28, height: 30 },
  ],
  goal: { x: 8850, y: 330, width: 44, height: 90 },
};

/* =========================================================================
 * LEVEL 4: QUANTUM (Hazard Surge & Micro Landing Pads)
 * ========================================================================= */
export const LEVEL_4_QUANTUM: LevelData = {
  id: 'level-4-quantum',
  name: 'Level 4: Quantum',
  subtitle: 'Rapid micro-platforms and tight timing windows',
  difficulty: 'Expert',
  difficultyRank: 4,
  accentColor: '#EC4899',
  lengthMeters: 10100,
  groundY: 420,
  groundHeight: 140,
  playerStart: { x: 120, y: 388 },
  groundSections: [
    { x: 0, y: 420, width: 1400, height: 140 },
    { x: 2600, y: 420, width: 1300, height: 140 },
    { x: 5000, y: 420, width: 1400, height: 140 },
    { x: 7500, y: 420, width: 1200, height: 140 },
    { x: 9300, y: 420, width: 1200, height: 140 },
  ],
  platforms: [
    // Zone 1: Micro pads across void
    { x: 1350, y: 370, width: 140, height: 20 },
    { x: 1620, y: 310, width: 140, height: 20 },
    { x: 1890, y: 260, width: 140, height: 20 },
    { x: 2160, y: 310, width: 140, height: 20 },
    { x: 2420, y: 360, width: 140, height: 20 },

    // Zone 2: Multi-tier zig-zag
    { x: 3850, y: 370, width: 150, height: 20 },
    { x: 4090, y: 310, width: 150, height: 20 },
    { x: 4330, y: 250, width: 150, height: 20 },
    { x: 4570, y: 300, width: 150, height: 20 },
    { x: 4800, y: 360, width: 160, height: 20 },

    // Zone 3: Sky Run (6350 -> 7550)
    { x: 6350, y: 360, width: 150, height: 20 },
    { x: 6600, y: 300, width: 140, height: 20 },
    { x: 6840, y: 240, width: 140, height: 20 },
    { x: 7080, y: 290, width: 140, height: 20 },
    { x: 7320, y: 350, width: 150, height: 20 },

    // Zone 4: Quantum leap sequence
    { x: 8650, y: 360, width: 140, height: 20 },
    { x: 8880, y: 300, width: 140, height: 20 },
    { x: 9110, y: 350, width: 150, height: 20 },

    // Final sprint
    { x: 9600, y: 350, width: 180, height: 20 },
    { x: 9860, y: 290, width: 180, height: 20 },
  ],
  spikes: [
    // Dense starter spikes
    { x: 600, y: 390, width: 28, height: 30 },
    { x: 850, y: 390, width: 28, height: 30 },
    { x: 878, y: 390, width: 28, height: 30 },
    { x: 1100, y: 390, width: 28, height: 30 },
    { x: 1128, y: 390, width: 28, height: 30 },

    // Micro pad spikes
    { x: 1670, y: 280, width: 28, height: 30 },
    { x: 2210, y: 280, width: 28, height: 30 },

    // Ground 2 gauntlet
    { x: 2750, y: 390, width: 28, height: 30 },
    { x: 3050, y: 390, width: 28, height: 30 },
    { x: 3078, y: 390, width: 28, height: 30 },
    { x: 3350, y: 390, width: 28, height: 30 },
    { x: 3378, y: 390, width: 28, height: 30 },
    { x: 3600, y: 390, width: 28, height: 30 },

    // Zig-zag spikes
    { x: 4140, y: 280, width: 28, height: 30 },
    { x: 4620, y: 270, width: 28, height: 30 },

    // Ground 3 gauntlet
    { x: 5150, y: 390, width: 28, height: 30 },
    { x: 5450, y: 390, width: 28, height: 30 },
    { x: 5478, y: 390, width: 28, height: 30 },
    { x: 5800, y: 390, width: 28, height: 30 },
    { x: 5828, y: 390, width: 28, height: 30 },
    { x: 6100, y: 390, width: 28, height: 30 },

    // Sky run spikes
    { x: 6650, y: 270, width: 28, height: 30 },
    { x: 7130, y: 260, width: 28, height: 30 },

    // Zone 4 & finish spikes
    { x: 7650, y: 390, width: 28, height: 30 },
    { x: 7950, y: 390, width: 28, height: 30 },
    { x: 7978, y: 390, width: 28, height: 30 },
    { x: 8250, y: 390, width: 28, height: 30 },
    { x: 8930, y: 270, width: 28, height: 30 },
    { x: 9670, y: 320, width: 28, height: 30 },
    { x: 9930, y: 260, width: 28, height: 30 },
  ],
  goal: { x: 10050, y: 330, width: 44, height: 90 },
};

/* =========================================================================
 * LEVEL 5: APEX (Master Gauntlet - The Ultimate Rush)
 * ========================================================================= */
export const LEVEL_5_APEX: LevelData = {
  id: 'level-5-apex',
  name: 'Level 5: Apex',
  subtitle: 'The supreme test of precision, rhythm & nerves',
  difficulty: 'Master',
  difficultyRank: 5,
  accentColor: '#10B981',
  lengthMeters: 11400,
  groundY: 420,
  groundHeight: 140,
  playerStart: { x: 120, y: 388 },
  groundSections: [
    { x: 0, y: 420, width: 1200, height: 140 },
    { x: 2800, y: 420, width: 1200, height: 140 },
    { x: 5600, y: 420, width: 1200, height: 140 },
    { x: 8200, y: 420, width: 1200, height: 140 },
    { x: 10600, y: 420, width: 1000, height: 140 },
  ],
  platforms: [
    // Gauntlet 1: High-rise stairway
    { x: 1150, y: 370, width: 140, height: 20 },
    { x: 1390, y: 310, width: 130, height: 20 },
    { x: 1620, y: 250, width: 130, height: 20 },
    { x: 1850, y: 190, width: 130, height: 20 }, // Sky high
    { x: 2080, y: 250, width: 130, height: 20 },
    { x: 2310, y: 310, width: 130, height: 20 },
    { x: 2540, y: 370, width: 140, height: 20 },

    // Gauntlet 2: Tight rhythm stepping
    { x: 3950, y: 370, width: 140, height: 20 },
    { x: 4180, y: 310, width: 130, height: 20 },
    { x: 4410, y: 250, width: 130, height: 20 },
    { x: 4640, y: 190, width: 130, height: 20 },
    { x: 4870, y: 250, width: 130, height: 20 },
    { x: 5100, y: 310, width: 130, height: 20 },
    { x: 5330, y: 370, width: 140, height: 20 },

    // Gauntlet 3: Extreme floating hurdles
    { x: 6750, y: 370, width: 130, height: 20 },
    { x: 6980, y: 300, width: 130, height: 20 },
    { x: 7210, y: 230, width: 130, height: 20 },
    { x: 7440, y: 290, width: 130, height: 20 },
    { x: 7670, y: 350, width: 130, height: 20 },
    { x: 7900, y: 380, width: 140, height: 20 },

    // Gauntlet 4: Final grand ascent
    { x: 9350, y: 360, width: 140, height: 20 },
    { x: 9580, y: 290, width: 130, height: 20 },
    { x: 9810, y: 220, width: 130, height: 20 },
    { x: 10040, y: 280, width: 130, height: 20 },
    { x: 10270, y: 340, width: 140, height: 20 },
  ],
  spikes: [
    // Brutal intro spikes
    { x: 450, y: 390, width: 28, height: 30 },
    { x: 650, y: 390, width: 28, height: 30 },
    { x: 678, y: 390, width: 28, height: 30 },
    { x: 900, y: 390, width: 28, height: 30 },
    { x: 928, y: 390, width: 28, height: 30 },

    // Stairway spikes
    { x: 1440, y: 280, width: 28, height: 30 },
    { x: 1900, y: 160, width: 28, height: 30 }, // Sky high spike
    { x: 2360, y: 280, width: 28, height: 30 },

    // Ground 2 gauntlet
    { x: 2950, y: 390, width: 28, height: 30 },
    { x: 3200, y: 390, width: 28, height: 30 },
    { x: 3228, y: 390, width: 28, height: 30 },
    { x: 3500, y: 390, width: 28, height: 30 },
    { x: 3528, y: 390, width: 28, height: 30 },
    { x: 3556, y: 390, width: 28, height: 30 }, // Triple

    // Stepping spikes
    { x: 4230, y: 280, width: 28, height: 30 },
    { x: 4690, y: 160, width: 28, height: 30 },
    { x: 5150, y: 280, width: 28, height: 30 },

    // Ground 3 gauntlet
    { x: 5750, y: 390, width: 28, height: 30 },
    { x: 6000, y: 390, width: 28, height: 30 },
    { x: 6028, y: 390, width: 28, height: 30 },
    { x: 6300, y: 390, width: 28, height: 30 },
    { x: 6328, y: 390, width: 28, height: 30 },

    // Floating hurdle spikes
    { x: 7030, y: 270, width: 28, height: 30 },
    { x: 7490, y: 260, width: 28, height: 30 },

    // Ground 4 gauntlet
    { x: 8350, y: 390, width: 28, height: 30 },
    { x: 8600, y: 390, width: 28, height: 30 },
    { x: 8628, y: 390, width: 28, height: 30 },
    { x: 8900, y: 390, width: 28, height: 30 },
    { x: 8928, y: 390, width: 28, height: 30 },

    // Final ascent & finish spikes
    { x: 9630, y: 260, width: 28, height: 30 },
    { x: 10090, y: 250, width: 28, height: 30 },
    { x: 10750, y: 390, width: 28, height: 30 },
    { x: 10778, y: 390, width: 28, height: 30 },
    { x: 11050, y: 390, width: 28, height: 30 },
    { x: 11078, y: 390, width: 28, height: 30 },
    { x: 11106, y: 390, width: 28, height: 30 }, // Final triple hurdle before goal
  ],
  goal: { x: 11350, y: 330, width: 44, height: 90 },
};

export const ALL_LEVELS: LevelData[] = [
  LEVEL_1_GENESIS,
  LEVEL_2_VELOCITY,
  LEVEL_3_OVERDRIVE,
  LEVEL_4_QUANTUM,
  LEVEL_5_APEX,
];

// Default level fallback
export const TUTORIAL_LEVEL: LevelData = LEVEL_1_GENESIS;
