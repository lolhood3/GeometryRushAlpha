/** Linear-ish RGB triple in 0..1. */
export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function toHex(c: RGB): string {
  const p = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${p(c[0])}${p(c[1])}${p(c[2])}`;
}

export function mix(a: RGB, b: RGB, t: number, out: RGB = [0, 0, 0]): RGB {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

export function scale(a: RGB, k: number): RGB {
  return [a[0] * k, a[1] * k, a[2] * k];
}

/** Packs to the little-endian RGBA8 layout used by the instance buffer. */
export function pack(c: RGB, a = 1): number {
  const r = c[0] <= 0 ? 0 : c[0] >= 1 ? 255 : (c[0] * 255) | 0;
  const g = c[1] <= 0 ? 0 : c[1] >= 1 ? 255 : (c[1] * 255) | 0;
  const b = c[2] <= 0 ? 0 : c[2] >= 1 ? 255 : (c[2] * 255) | 0;
  const al = a <= 0 ? 0 : a >= 1 ? 255 : (a * 255) | 0;
  return ((al << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function packRGB(r: number, g: number, b: number, a = 1): number {
  const cl = (v: number) => (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0);
  return ((cl(a) << 24) | (cl(b) << 16) | (cl(g) << 8) | cl(r)) >>> 0;
}

export const WHITE: RGB = [1, 1, 1];
export const BLACK: RGB = [0, 0, 0];
