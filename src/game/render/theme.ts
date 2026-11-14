import { hex, mix, type RGB } from '../../engine/gfx/color.ts';
import { smoothstep } from '../../engine/math.ts';
import type { Level } from '../sim/level.ts';

export interface Palette {
  sky0: RGB;
  sky1: RGB;
  accent: RGB;
  accent2: RGB;
  hazard: RGB;
}

const KEYS = ['sky0', 'sky1', 'accent', 'accent2', 'hazard'] as const;

/** Resolves the level's colour scheme at any beat, cross-fading at theme triggers. */
export class ThemeTrack {
  readonly current: Palette = { sky0: [0, 0, 0], sky1: [0, 0, 0], accent: [0, 0, 0], accent2: [0, 0, 0], hazard: [0, 0, 0] };
  private readonly palettes: Palette[];
  private readonly marks: { beat: number; theme: number }[] = [{ beat: -1e9, theme: 0 }];

  constructor(level: Level) {
    this.palettes = level.meta.themes.map((t) => ({
      sky0: hex(t.sky0), sky1: hex(t.sky1), accent: hex(t.accent), accent2: hex(t.accent2), hazard: hex(t.hazard),
    }));
    for (const t of level.triggers) {
      if (t.kind === 'theme') this.marks.push({ beat: t.beat, theme: t.theme % this.palettes.length });
    }
    this.marks.sort((a, b) => a.beat - b.beat);
    this.at(0);
  }

  at(beat: number): Palette {
    const m = this.marks;
    let i = m.length - 1;
    while (i > 0 && m[i].beat > beat) i--;
    const to = this.palettes[m[i].theme];
    const from = i > 0 ? this.palettes[m[i - 1].theme] : to;
    const t = i > 0 ? smoothstep(0, 1.5, beat - m[i].beat) : 1;
    for (const k of KEYS) mix(from[k], to[k], t, this.current[k]);
    return this.current;
  }
}
