import type { CellPosition } from './cell';

/**
 * Pure cell rasterizers for the editor's shape tools and symmetry mode.
 * Every function returns grid cells (integer coordinates); callers clip to
 * the grid bounds with `clipToGrid`.
 */

export type Symmetry = 'none' | 'vertical' | 'horizontal' | 'both';

/** Bresenham line between two cells, inclusive of both ends. */
export function linePoints(a: CellPosition, b: CellPosition): CellPosition[] {
  const points: CellPosition[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    points.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

function bounds(a: CellPosition, b: CellPosition) {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  };
}

/** Rectangle spanned by two opposite corners: outline only, or filled. */
export function rectPoints(a: CellPosition, b: CellPosition, filled: boolean): CellPosition[] {
  const { x0, y0, x1, y1 } = bounds(a, b);
  const points: CellPosition[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (filled || y === y0 || y === y1 || x === x0 || x === x1) points.push({ x, y });
    }
  }
  return points;
}

/**
 * Ellipse inscribed in the box spanned by two corners. A cell is inside when
 * its centre falls within the ellipse; the outline is every inside cell with
 * an orthogonal neighbour outside, which keeps outlines 4-connected (no gaps
 * a stitcher would have to jump) for any box size, including 1-cell-wide.
 */
export function ellipsePoints(a: CellPosition, b: CellPosition, filled: boolean): CellPosition[] {
  const { x0, y0, x1, y1 } = bounds(a, b);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const cx = x0 + (w - 1) / 2;
  const cy = y0 + (h - 1) / 2;
  const rx = w / 2;
  const ry = h / 2;

  const inside = (x: number, y: number) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1;
  };

  const points: CellPosition[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
      if (filled || edge) points.push({ x, y });
    }
  }
  return points;
}

/**
 * Adds the mirror images of each point across the pattern's vertical and/or
 * horizontal centre line, de-duplicated (cells on the axis appear once).
 */
export function mirrorPoints(
  points: readonly CellPosition[],
  width: number,
  height: number,
  symmetry: Symmetry,
): CellPosition[] {
  if (symmetry === 'none') return [...points];
  const seen = new Set<number>();
  const out: CellPosition[] = [];
  const add = (x: number, y: number) => {
    const key = y * width + x;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y });
  };
  const mirrorX = symmetry === 'vertical' || symmetry === 'both';
  const mirrorY = symmetry === 'horizontal' || symmetry === 'both';
  for (const { x, y } of points) {
    const mx = width - 1 - x;
    const my = height - 1 - y;
    add(x, y);
    if (mirrorX) add(mx, y);
    if (mirrorY) add(x, my);
    if (mirrorX && mirrorY) add(mx, my);
  }
  return out;
}

export function clipToGrid(
  points: readonly CellPosition[],
  width: number,
  height: number,
): CellPosition[] {
  return points.filter((p) => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height);
}
