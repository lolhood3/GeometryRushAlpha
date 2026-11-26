import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ribbonEdges, ribbonMesh } from '../src/engine/gfx/ribbon.ts';

type Path = [number, number][];
type Width = number | ((t: number) => number);

function points(path: Path, width: Width): Float32Array {
  const n = path.length;
  const pts = new Float32Array(n * 4);
  path.forEach(([x, y], i) => {
    const t = i / (n - 1);
    pts.set([x, y, typeof width === 'number' ? width : width(t), t * t], i * 4);
  });
  return pts;
}

/** The signed area of every triangle of the ribbon through `path`. */
function areas(path: Path, width: Width): number[] {
  const n = path.length;
  const out = new Float32Array((n - 1) * 24);
  assert.equal(ribbonMesh(points(path, width), n, out), (n - 1) * 24);
  const res: number[] = [];
  for (let k = 0; k < (n - 1) * 6; k += 3) {
    const [ax, ay, bx, by, cx, cy] = [out[k * 4], out[k * 4 + 1], out[k * 4 + 4], out[k * 4 + 5], out[k * 4 + 8], out[k * 4 + 9]];
    res.push(((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2);
  }
  return res;
}
/** No triangle may face the other way: that is a fold, and a fold is drawn twice. */
const folds = (a: number[]): number => a.filter((x) => x < -1e-6).length;

/** A jump as the game records it: a point every 0.241 cells, an arc, then a hard landing. */
function jump(): Path {
  const ys = [0.5, 0.5, 0.5, 0.5, 0.931, 1.375, 1.755, 2.07, 2.322, 2.51, 2.634, 2.694, 2.69, 2.622, 2.49, 2.294, 2.034, 1.711, 1.323, 0.872, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  return ys.map((y, i) => [i * 0.241, y]);
}
/** 45° up and down, turning every three points: the sharpest path the game makes. */
function zigzag(): Path {
  const path: Path = [];
  let y = 2;
  for (let i = 0; i < 40; i++) { path.push([i * 0.22, y]); y += (Math.floor(i / 3) % 2 === 0 ? 1 : -1) * 0.22; }
  return path;
}

test('ribbon: a straight path is a plain band of the asked width', () => {
  const path: Path = Array.from({ length: 8 }, (_, i) => [i * 0.25, 1]);
  const a = areas(path, 0.3);
  assert.equal(a.length, 14);
  for (const x of a) assert.ok(Math.abs(x - 0.25 * 0.6 / 2) < 1e-6, `every triangle is half a 0.25 × 0.6 piece, got ${x}`);
});

test('ribbon: the landing after a jump does not fold it, at any trail width', () => {
  for (const w of [0.16, 0.26, 0.3, 0.38, 0.465, 0.475, 0.6]) {
    assert.equal(folds(areas(jump(), w)), 0, `half width ${w}`);
    // As the game draws it: narrow at the tail, full width at the head.
    assert.equal(folds(areas(jump(), (t) => w * (0.25 + 0.75 * t))), 0, `tapered to ${w}`);
  }
});

test('ribbon: the zigzag of the wave does not fold it', () => {
  for (const w of [0.2, 0.33, 0.475]) assert.equal(folds(areas(zigzag(), w)), 0, `half width ${w}`);
});

test('ribbon: a gentle curve is left as it was', () => {
  // Nothing to correct here: every edge point is the centre point moved square to the path by the half width.
  const n = 24;
  const pts = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) pts.set([i * 0.24, Math.sin(i * 0.2) * 1.5, 0.3, 1], i * 4);
  const e = new Float32Array(n * 4);
  ribbonEdges(pts, n, e);
  for (let i = 0; i < n; i++) {
    for (const k of [0, 2]) {
      const d = Math.hypot(e[i * 4 + k] - pts[i * 4], e[i * 4 + k + 1] - pts[i * 4 + 1]);
      assert.ok(d >= 0.3 - 1e-5 && d < 0.3 * 1.01, `point ${i} is ${d} from the path`);
    }
  }
});

test('ribbon: it keeps its width through a corner', () => {
  // A 60° bend. The outer edge point lies on the bisector, 30° off square, so it is 0.2 / cos 30° out.
  const path: Path = [];
  for (let i = 5; i > 0; i--) path.push([-i * 0.25 * 0.5, i * 0.25 * 0.866]);
  for (let i = 0; i < 6; i++) path.push([i * 0.25, 0]);
  const n = path.length;
  const e = new Float32Array(n * 4);
  ribbonEdges(points(path, 0.2), n, e);
  const outer = Math.hypot(e[5 * 4 + 2] - path[5][0], e[5 * 4 + 3] - path[5][1]);
  assert.ok(Math.abs(outer - 0.2 / Math.cos(Math.PI / 6)) < 1e-4, `outer edge at the corner is ${outer} out`);
  assert.equal(folds(areas(path, 0.2)), 0);
});

test('ribbon: a piece is cut along its shorter diagonal', () => {
  // At the landing the piece after the corner is nearly a triangle. Cut the long way, one half is a sliver.
  // (Narrow enough here that no edge point has to be held back, which makes a piece a triangle on purpose.)
  const a = areas(jump(), 0.16);
  const pieces: number[] = [];
  for (let i = 0; i < a.length; i += 2) pieces.push(Math.min(a[i], a[i + 1]) / (a[i] + a[i + 1]));
  // The smaller half of every piece is a fair share of it.
  assert.ok(Math.min(...pieces) > 0.2, `smallest share ${Math.min(...pieces)}`);
});

test('ribbon: the two edges carry -1 and 1, and each point its own alpha', () => {
  const path: Path = [[0, 0], [0.3, 0], [0.6, 0.2]];
  const pts = points(path, 0.2);
  const out = new Float32Array(48);
  ribbonMesh(pts, 3, out);
  for (let k = 0; k < 12; k++) {
    const across = out[k * 4 + 2];
    assert.ok(across === 1 || across === -1);
    const alpha = out[k * 4 + 3];
    assert.ok([0, 0.25, 1].includes(alpha), `alpha ${alpha}`);
  }
});

test('ribbon: two points on the same spot, or fewer than two points, do not break it', () => {
  const a = areas([[0, 0], [0.2, 0], [0.2, 0], [0.4, 0.3], [0.6, 0.3]], 0.3);
  assert.equal(folds(a), 0);
  assert.ok(a.every((x) => Number.isFinite(x)));
  assert.equal(ribbonMesh(new Float32Array(4), 1, new Float32Array(24)), 0);
});
