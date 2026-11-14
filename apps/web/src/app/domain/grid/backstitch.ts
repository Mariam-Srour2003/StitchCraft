import type { Backstitch } from '@stitchcraft/types';

import type { CellPosition } from './cell';

/**
 * Pure backstitch geometry: snapping, hit-testing and the whole-pattern
 * transforms that must move lines in step with the cells under them.
 * Corners are grid intersections, (0, 0) to (width, height).
 */

/** The grid corner nearest a pointer position given in fractional cells. */
export function nearestCorner(fx: number, fy: number, width: number, height: number): CellPosition {
  return {
    x: Math.min(width, Math.max(0, Math.round(fx))),
    y: Math.min(height, Math.max(0, Math.round(fy))),
  };
}

/** True when two lines join the same two corners, in either direction. */
export function sameLine(a: Backstitch, b: Backstitch): boolean {
  return (
    (a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2) ||
    (a.x1 === b.x2 && a.y1 === b.y2 && a.x2 === b.x1 && a.y2 === b.y1)
  );
}

/** Distance from a point to a line segment, in cells. */
export function distanceToLine(px: number, py: number, line: Backstitch): number {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - line.x1) * dx + (py - line.y1) * dy) / lengthSq));
  return Math.hypot(px - (line.x1 + t * dx), py - (line.y1 + t * dy));
}

/**
 * Index of the line closest to a point (fractional cells) within
 * `maxDistance`, or -1. When lines overlap, the most recently drawn wins,
 * matching what's visible on top.
 */
export function nearestLine(
  lines: readonly Backstitch[],
  px: number,
  py: number,
  maxDistance = 0.5,
): number {
  let best = -1;
  let bestDistance = maxDistance;
  for (let i = lines.length - 1; i >= 0; i--) {
    const distance = distanceToLine(px, py, lines[i]);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

const mapCorners = (
  lines: readonly Backstitch[],
  map: (x: number, y: number) => [number, number],
): Backstitch[] =>
  lines.map((line) => {
    const [x1, y1] = map(line.x1, line.y1);
    const [x2, y2] = map(line.x2, line.y2);
    return { x1, y1, x2, y2, paletteIndex: line.paletteIndex };
  });

export function flipLinesHorizontal(lines: readonly Backstitch[], width: number): Backstitch[] {
  return mapCorners(lines, (x, y) => [width - x, y]);
}

export function flipLinesVertical(lines: readonly Backstitch[], height: number): Backstitch[] {
  return mapCorners(lines, (x, y) => [x, height - y]);
}

/** Matches rotating the cells clockwise: corner (x, y) moves to (height - y, x). */
export function rotateLinesClockwise(lines: readonly Backstitch[], height: number): Backstitch[] {
  return mapCorners(lines, (x, y) => [height - y, x]);
}

/** Keeps only lines that still fit after a resize (top-left anchored, like the cells). */
export function clipLines(
  lines: readonly Backstitch[],
  width: number,
  height: number,
): Backstitch[] {
  return lines.filter((l) => Math.max(l.x1, l.x2) <= width && Math.max(l.y1, l.y2) <= height);
}

/** Applies a palette re-numbering (`remap[old]` = new index, -1 = removed), dropping removed colors. */
export function remapLines(lines: readonly Backstitch[], remap: Int16Array): Backstitch[] {
  return lines
    .filter((l) => (remap[l.paletteIndex] ?? -1) >= 0)
    .map((l) => ({ ...l, paletteIndex: remap[l.paletteIndex] }));
}

export function recolorLines(lines: readonly Backstitch[], from: number, to: number): Backstitch[] {
  return lines.map((l) => (l.paletteIndex === from ? { ...l, paletteIndex: to } : l));
}

export function usedLineColors(lines: readonly Backstitch[]): Set<number> {
  return new Set(lines.map((l) => l.paletteIndex));
}
