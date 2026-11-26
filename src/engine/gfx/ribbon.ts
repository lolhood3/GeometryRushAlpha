/**
 * Turns a path into the triangles of a ribbon.
 *
 * `pts` holds (x, y, halfWidth, alpha) per point, oldest first. Every point
 * gets a cross-section: one point on each edge of the ribbon, square to the
 * path there. Two neighbouring cross-sections make a four-sided piece, which
 * is drawn as two triangles. Three things keep that clean where the path
 * bends sharply, as it does when the cube lands or the wave turns:
 *
 *  - Width. At a bend the cross-section lies along the bisector, which crosses
 *    the ribbon at a slant, so it is made longer by 1 / cos(half the bend).
 *    Otherwise the ribbon narrows to a waist at every corner.
 *  - Folds. Where the bend is tighter than the ribbon is wide, the next
 *    cross-section lies partly behind the previous one and the piece between
 *    them folds over itself. The fold is drawn twice, and because the ribbon
 *    adds light it shows as a bright sliver straight across the bend. An edge
 *    point that would fall behind the previous cross-section stays where the
 *    previous one was instead, and the ribbon turns about that point.
 *  - The split. Each piece is cut along its shorter diagonal. At a corner the
 *    piece is close to a triangle; cut the long way, the brightness across the
 *    ribbon is squeezed into one thin triangle and stretched over the other.
 */

/** The cosine of the half bend below which a corner is no longer widened (a bend of about 90°). */
const MITER_LIMIT = 0.7;

/**
 * Writes the two edge points of every cross-section to `edges` as
 * (leftX, leftY, rightX, rightY) per point. `edges` needs `n * 4` floats.
 */
export function ribbonEdges(pts: Float32Array, n: number, edges: Float32Array): void {
  // The previous cross-section.
  let plx = 0, ply = 0, prx = 0, pry = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1) * 4;
    const b = Math.min(n - 1, i + 1) * 4;
    let dx = pts[b] - pts[a];
    let dy = pts[b + 1] - pts[a + 1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const x = pts[i * 4], y = pts[i * 4 + 1];
    let w = pts[i * 4 + 2];
    if (i > 0 && i < n - 1) {
      const ix = x - pts[a], iy = y - pts[a + 1];
      const il = Math.hypot(ix, iy);
      if (il > 0) w /= Math.max(MITER_LIMIT, (ix * dx + iy * dy) / il);
    }
    let lx = x - dy * w, ly = y + dx * w;
    let rx = x + dy * w, ry = y - dx * w;
    if (i > 0) {
      // Which side of the previous cross-section each new edge point is on: positive is ahead of it.
      const cx = prx - plx, cy = pry - ply;
      if (cx * (ly - ply) - cy * (lx - plx) < 0) { lx = plx; ly = ply; }
      if (cx * (ry - ply) - cy * (rx - plx) < 0) { rx = prx; ry = pry; }
      // With both ahead, the new cross-section can still be turned so far that the piece crosses itself.
      if ((lx - prx) * (ry - pry) - (ly - pry) * (rx - prx) > 0) { rx = prx; ry = pry; }
    }
    const o = i * 4;
    edges[o] = lx; edges[o + 1] = ly; edges[o + 2] = rx; edges[o + 3] = ry;
    plx = lx; ply = ly; prx = rx; pry = ry;
  }
}

let scratch = new Float32Array(0);

/**
 * Writes the ribbon through `n` points to `out` as separate triangles, six
 * vertices per piece, each vertex (x, y, across, alpha) with `across` -1 on
 * one edge and 1 on the other. `out` needs `(n - 1) * 24` floats. Returns the
 * number of floats written.
 */
export function ribbonMesh(pts: Float32Array, n: number, out: Float32Array): number {
  if (n < 2) return 0;
  if (scratch.length < n * 4) scratch = new Float32Array(n * 4);
  const e = scratch;
  ribbonEdges(pts, n, e);
  let o = 0;
  const put = (i: number, right: boolean): void => {
    out[o++] = e[i * 4 + (right ? 2 : 0)];
    out[o++] = e[i * 4 + (right ? 3 : 1)];
    out[o++] = right ? 1 : -1;
    out[o++] = pts[i * 4 + 3];
  };
  for (let i = 0; i + 1 < n; i++) {
    const j = i + 1;
    const a = i * 4, b = j * 4;
    // Diagonal from this right edge point to the next left one, against the other way round.
    const d1 = (e[b] - e[a + 2]) ** 2 + (e[b + 1] - e[a + 3]) ** 2;
    const d2 = (e[b + 2] - e[a]) ** 2 + (e[b + 3] - e[a + 1]) ** 2;
    if (d1 <= d2) {
      put(i, false); put(i, true); put(j, false);
      put(j, false); put(i, true); put(j, true);
    } else {
      put(i, false); put(i, true); put(j, true);
      put(i, false); put(j, true); put(j, false);
    }
  }
  return o;
}
