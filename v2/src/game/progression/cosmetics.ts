import { getLevel, LEVEL_IDS } from '../levels/index.ts';
import { type Profile, totalShards } from './profile.ts';

/** How a cosmetic is earned. Evaluated live against the profile – never stored. */
export type Unlock =
  | { kind: 'default' }
  | { kind: 'level'; level: string }
  | { kind: 'stars'; count: number }
  | { kind: 'shards'; count: number }
  | { kind: 'achievement'; id: string }
  | { kind: 'veteran'; stars: number };

/** One layer of a chassis icon, in a unit square centred on the origin. */
export interface ChassisPart {
  shape: 'box' | 'circle' | 'tri' | 'diamond';
  x: number;
  y: number;
  w: number;
  h: number;
  /** p = primary, s = secondary, k = dark core, w = white */
  color: 'p' | 's' | 'k' | 'w';
  rot?: number;
  radius?: number;
}

export interface Chassis {
  id: string;
  name: string;
  blurb: string;
  unlock: Unlock;
  /** Outline only (hollow body). */
  hollow?: boolean;
  parts: ChassisPart[];
}

export interface Paint {
  id: string;
  name: string;
  hex: string;
  unlock: Unlock;
}

export interface Trail {
  id: string;
  name: string;
  blurb: string;
  unlock: Unlock;
  width: number;
  length: number;
  /** Blend the tail towards the secondary colour. */
  dual?: boolean;
  /** Width breathes with the kick drum. */
  pulse?: boolean;
  sparks?: boolean;
}

export const CHASSIS: Chassis[] = [
  { id: 'core', name: 'Core', blurb: 'The original kinetic cube.', unlock: { kind: 'default' },
    parts: [{ shape: 'box', x: 0, y: 0, w: 0.46, h: 0.46, color: 's', radius: 0.04 }] },
  { id: 'vector', name: 'Vector', blurb: 'A blade folded into a square.', unlock: { kind: 'default' },
    parts: [{ shape: 'diamond', x: 0, y: 0, w: 0.5, h: 0.5, color: 's' }] },
  { id: 'iris', name: 'Iris', blurb: 'It watches the beat.', unlock: { kind: 'level', level: 'genesis' },
    parts: [
      { shape: 'circle', x: 0, y: 0, w: 0.58, h: 0.58, color: 's' },
      { shape: 'circle', x: 0.06, y: 0, w: 0.24, h: 0.24, color: 'k' },
    ] },
  { id: 'prism', name: 'Prism', blurb: 'Light, split three ways.', unlock: { kind: 'shards', count: 3 },
    parts: [{ shape: 'tri', x: 0, y: -0.02, w: 0.56, h: 0.5, color: 's' }] },
  { id: 'quad', name: 'Quad', blurb: 'Four cores. One pulse.', unlock: { kind: 'level', level: 'velocity' },
    parts: [
      { shape: 'box', x: -0.17, y: 0.17, w: 0.22, h: 0.22, color: 's', radius: 0.03 },
      { shape: 'box', x: 0.17, y: 0.17, w: 0.22, h: 0.22, color: 's', radius: 0.03 },
      { shape: 'box', x: -0.17, y: -0.17, w: 0.22, h: 0.22, color: 's', radius: 0.03 },
      { shape: 'box', x: 0.17, y: -0.17, w: 0.22, h: 0.22, color: 'w', radius: 0.03 },
    ] },
  { id: 'visor', name: 'Visor', blurb: 'Eyes on the road ahead.', unlock: { kind: 'achievement', id: 'frequent-flyer' },
    parts: [
      { shape: 'box', x: 0, y: 0.1, w: 0.74, h: 0.3, color: 'k', radius: 0.06 },
      { shape: 'box', x: -0.02, y: 0.1, w: 0.16, h: 0.16, color: 's', radius: 0.02 },
      { shape: 'box', x: 0.22, y: 0.1, w: 0.16, h: 0.16, color: 's', radius: 0.02 },
    ] },
  { id: 'split', name: 'Split', blurb: 'Half light, half shadow.', unlock: { kind: 'level', level: 'overdrive' },
    parts: [
      { shape: 'box', x: 0.2, y: 0, w: 0.4, h: 0.8, color: 's', radius: 0.02 },
      { shape: 'box', x: -0.2, y: 0, w: 0.14, h: 0.44, color: 'k', radius: 0.02 },
    ] },
  { id: 'reactor', name: 'Reactor', blurb: 'Containment at ninety percent.', unlock: { kind: 'shards', count: 9 },
    parts: [
      { shape: 'circle', x: 0, y: 0, w: 0.68, h: 0.68, color: 's' },
      { shape: 'circle', x: 0, y: 0, w: 0.46, h: 0.46, color: 'p' },
      { shape: 'circle', x: 0, y: 0, w: 0.2, h: 0.2, color: 'w' },
    ] },
  { id: 'circuit', name: 'Circuit', blurb: 'Every path is a signal.', unlock: { kind: 'level', level: 'quantum' },
    parts: [
      { shape: 'box', x: 0, y: 0, w: 0.72, h: 0.16, color: 's', radius: 0.03 },
      { shape: 'box', x: 0, y: 0, w: 0.16, h: 0.72, color: 's', radius: 0.03 },
      { shape: 'box', x: 0, y: 0, w: 0.24, h: 0.24, color: 'k', radius: 0.03 },
    ] },
  { id: 'phantom', name: 'Phantom', blurb: 'Barely there. Still here.', unlock: { kind: 'achievement', id: 'persistent' }, hollow: true,
    parts: [{ shape: 'box', x: 0, y: 0, w: 0.3, h: 0.3, color: 'p', radius: 0.03 }] },
  { id: 'nova', name: 'Nova', blurb: 'Forged from perfect timing.', unlock: { kind: 'achievement', id: 'perfect-sync' },
    parts: [
      { shape: 'box', x: 0, y: 0, w: 0.52, h: 0.52, color: 's', radius: 0.02 },
      { shape: 'diamond', x: 0, y: 0, w: 0.74, h: 0.74, color: 's' },
      { shape: 'circle', x: 0, y: 0, w: 0.22, h: 0.22, color: 'w' },
    ] },
  { id: 'summit', name: 'Summit', blurb: 'For those who reached the top.', unlock: { kind: 'level', level: 'apex' },
    parts: [
      { shape: 'tri', x: 0, y: 0.12, w: 0.62, h: 0.34, color: 's' },
      { shape: 'tri', x: 0, y: -0.16, w: 0.62, h: 0.34, color: 'w' },
    ] },
  { id: 'alpha', name: 'Alpha', blurb: 'Issued to pilots of the original build.', unlock: { kind: 'veteran', stars: 20 },
    parts: [
      { shape: 'box', x: 0, y: 0, w: 0.62, h: 0.62, color: 'k', radius: 0.04 },
      { shape: 'box', x: 0, y: 0, w: 0.34, h: 0.34, color: 's', radius: 0.03 },
    ] },
];

export const PAINTS: Paint[] = [
  { id: 'cyan', name: 'Rush Cyan', hex: '#00e5ff', unlock: { kind: 'default' } },
  { id: 'ice', name: 'Ice', hex: '#eef4ff', unlock: { kind: 'default' } },
  { id: 'violet', name: 'Ultraviolet', hex: '#8b6cff', unlock: { kind: 'default' } },
  { id: 'graphite', name: 'Graphite', hex: '#39425c', unlock: { kind: 'default' } },
  { id: 'lime', name: 'Volt', hex: '#b6ff3d', unlock: { kind: 'stars', count: 2 } },
  { id: 'amber', name: 'Amber', hex: '#ffb627', unlock: { kind: 'stars', count: 6 } },
  { id: 'mint', name: 'Mint', hex: '#2bffb1', unlock: { kind: 'shards', count: 6 } },
  { id: 'pink', name: 'Hot Pink', hex: '#ff4fd8', unlock: { kind: 'stars', count: 12 } },
  { id: 'azure', name: 'Azure', hex: '#3d9bff', unlock: { kind: 'shards', count: 12 } },
  { id: 'crimson', name: 'Crimson', hex: '#ff3355', unlock: { kind: 'stars', count: 20 } },
  { id: 'gold', name: 'Gold', hex: '#ffd23f', unlock: { kind: 'stars', count: 30 } },
  { id: 'aurora', name: 'Aurora', hex: '#9dffea', unlock: { kind: 'shards', count: 15 } },
];

export const TRAILS: Trail[] = [
  { id: 'line', name: 'Tracer', blurb: 'A clean line of light.', unlock: { kind: 'default' }, width: 0.16, length: 26 },
  { id: 'none', name: 'None', blurb: 'No trail. Pure focus.', unlock: { kind: 'default' }, width: 0, length: 0 },
  { id: 'ribbon', name: 'Ribbon', blurb: 'Wide, soft and bright.', unlock: { kind: 'achievement', id: 'momentum' }, width: 0.38, length: 34 },
  { id: 'pulse', name: 'Pulse', blurb: 'Breathes with the kick drum.', unlock: { kind: 'achievement', id: 'in-sync' }, width: 0.3, length: 30, pulse: true },
  { id: 'dual', name: 'Duotone', blurb: 'Fades into your second colour.', unlock: { kind: 'achievement', id: 'collector-2' }, width: 0.3, length: 40, dual: true },
  { id: 'comet', name: 'Comet', blurb: 'Sheds sparks at speed.', unlock: { kind: 'achievement', id: 'superposition' }, width: 0.26, length: 36, sparks: true },
];

export function starsEarned(p: Profile): number {
  let n = 0;
  for (const id of LEVEL_IDS) if (p.levels[id].completed) n += getLevel(id).meta.stars;
  return n;
}

export function totalStars(): number {
  let n = 0;
  for (const id of LEVEL_IDS) n += getLevel(id).meta.stars;
  return n;
}

export function isUnlocked(u: Unlock, p: Profile): boolean {
  switch (u.kind) {
    case 'default': return true;
    case 'level': return !!p.levels[u.level]?.completed;
    case 'stars': return starsEarned(p) >= u.count;
    case 'shards': return totalShards(p) >= u.count;
    case 'achievement': return u.id in p.achievements;
    case 'veteran': return p.veteran || starsEarned(p) >= u.stars;
  }
}

export function unlockText(u: Unlock, achievementName: (id: string) => string): string {
  switch (u.kind) {
    case 'default': return 'Standard issue';
    case 'level': return `Complete ${getLevel(u.level).meta.name}`;
    case 'stars': return `Earn ${u.count} stars`;
    case 'shards': return `Bank ${u.count} shards`;
    case 'achievement': return `Achievement: ${achievementName(u.id)}`;
    case 'veteran': return `Alpha veteran, or earn ${u.stars} stars`;
  }
}

/** Progress towards an unlock as [current, target]. */
export function unlockProgress(u: Unlock, p: Profile): [number, number] {
  switch (u.kind) {
    case 'stars': return [Math.min(starsEarned(p), u.count), u.count];
    case 'shards': return [Math.min(totalShards(p), u.count), u.count];
    case 'veteran': return [Math.min(starsEarned(p), u.stars), u.stars];
    default: return [isUnlocked(u, p) ? 1 : 0, 1];
  }
}

export const findChassis = (id: string): Chassis => CHASSIS.find((c) => c.id === id) ?? CHASSIS[0];
export const findPaint = (id: string): Paint => PAINTS.find((c) => c.id === id) ?? PAINTS[0];
export const findTrail = (id: string): Trail => TRAILS.find((c) => c.id === id) ?? TRAILS[0];

/** Ids of every cosmetic currently unlocked (prefixed by category). */
export function unlockedCosmetics(p: Profile): string[] {
  const out: string[] = [];
  for (const c of CHASSIS) if (isUnlocked(c.unlock, p)) out.push(`chassis:${c.id}`);
  for (const c of PAINTS) if (isUnlocked(c.unlock, p)) out.push(`paint:${c.id}`);
  for (const c of TRAILS) if (isUnlocked(c.unlock, p)) out.push(`trail:${c.id}`);
  return out;
}

export function cosmeticName(key: string): string {
  const [cat, id] = key.split(':');
  if (cat === 'chassis') return `${findChassis(id).name} chassis`;
  if (cat === 'paint') return `${findPaint(id).name} paint`;
  return `${findTrail(id).name} trail`;
}
