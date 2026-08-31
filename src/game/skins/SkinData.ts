export interface SkinData {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  coreColor: string;
  strokeColor: string;
  coreStrokeColor: string;
  trailColor: string;
  trailGlow: string;
  unlockCondition: string;
  requiredLevelId?: string;
}

export const ALL_SKINS: SkinData[] = [
  {
    id: 'cyber-cyan',
    name: 'Cyber Cyan',
    description: 'The standard issue high-speed kinetic cube.',
    primaryColor: '#00E5FF',
    coreColor: '#00B4D8',
    strokeColor: '#FFFFFF',
    coreStrokeColor: '#90E0EF',
    trailColor: 'rgba(0, 229, 255, 0.25)',
    trailGlow: '#00E5FF',
    unlockCondition: 'Unlocked by Default',
  },
  {
    id: 'neon-blaze',
    name: 'Neon Blaze',
    description: 'Superheated plasma chassis tuned for raw velocity.',
    primaryColor: '#FF3B30',
    coreColor: '#FF9500',
    strokeColor: '#FFF3E0',
    coreStrokeColor: '#FFD60A',
    trailColor: 'rgba(255, 59, 48, 0.28)',
    trailGlow: '#FF3B30',
    unlockCondition: 'Clear Level 1: Genesis',
    requiredLevelId: 'level-1-genesis',
  },
  {
    id: 'emerald-surge',
    name: 'Emerald Surge',
    description: 'Bioluminescent quantum lattice with crystal resonance.',
    primaryColor: '#00FF88',
    coreColor: '#059669',
    strokeColor: '#ECFDF5',
    coreStrokeColor: '#6EE7B7',
    trailColor: 'rgba(0, 255, 136, 0.25)',
    trailGlow: '#00FF88',
    unlockCondition: 'Clear Level 2: Velocity',
    requiredLevelId: 'level-2-velocity',
  },
  {
    id: 'violet-phantom',
    name: 'Violet Phantom',
    description: 'Ethereal sub-dimensional phase shifter.',
    primaryColor: '#BF5AF2',
    coreColor: '#7C3AED',
    strokeColor: '#F5F3FF',
    coreStrokeColor: '#DDD6FE',
    trailColor: 'rgba(191, 90, 242, 0.28)',
    trailGlow: '#BF5AF2',
    unlockCondition: 'Clear Level 3: Overdrive',
    requiredLevelId: 'level-3-overdrive',
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    description: 'Radiant fusion core operating at peak temperatures.',
    primaryColor: '#FFD60A',
    coreColor: '#D97706',
    strokeColor: '#FFFBEB',
    coreStrokeColor: '#FDE68A',
    trailColor: 'rgba(255, 214, 10, 0.28)',
    trailGlow: '#FFD60A',
    unlockCondition: 'Clear Level 4: Quantum',
    requiredLevelId: 'level-4-quantum',
  },
  {
    id: 'hyper-nova',
    name: 'Hyper Nova',
    description: 'The master artifact forged at the apex of speed.',
    primaryColor: '#FF2D55',
    coreColor: '#4F46E5',
    strokeColor: '#FFFFFF',
    coreStrokeColor: '#38BDF8',
    trailColor: 'rgba(255, 45, 85, 0.3)',
    trailGlow: '#FF2D55',
    unlockCondition: 'Clear Level 5: Apex',
    requiredLevelId: 'level-5-apex',
  },
];

export const DEFAULT_SKIN_ID = 'cyber-cyan';

export function getSkinById(id: string): SkinData {
  return ALL_SKINS.find((s) => s.id === id) || ALL_SKINS[0];
}
