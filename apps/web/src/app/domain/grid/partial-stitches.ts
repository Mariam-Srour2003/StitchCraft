import type { PartialStitch, StitchPart } from '@stitchcraft/types';
import { partsOverlap } from '@stitchcraft/types';

/**
 * Pure partial-stitch editing: picking a part from where in a cell the user
 * clicked, placing parts without overlaps, and the whole-pattern transforms
 * that must move them in step with the cells under them.
 */

export type PartialKind = 'half' | 'quarter';

/**
 * The cell and part under a pointer position (fractional cells). Quarters
 * follow the clicked quadrant. Halves follow it too: a click near the
 * top-right or bottom-left corner gives "/", near the other two "\" - the
 * diagonal that passes through where you clicked.
 */
export function partAt(
  fx: number,
  fy: number,
  kind: PartialKind,
  width: number,
  height: number,
): { x: number; y: number; part: StitchPart } | null {
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const right = fx - x >= 0.5;
  const bottom = fy - y >= 0.5;
  if (kind === 'half') {
    return { x, y, part: right !== bottom ? 'half-up' : 'half-down' };
  }
  const part: StitchPart = bottom
    ? right
      ? 'quarter-br'
      : 'quarter-bl'
    : right
      ? 'quarter-tr'
      : 'quarter-tl';
  return { x, y, part };
}

/**
 * Places a stitch: anything it would overlap in that cell is replaced.
 * Placing exactly the same stitch again (same part, same colour) removes it,
 * so a second click undoes a mis-click.
 */
export function placePartial(
  stitches: readonly PartialStitch[],
  stitch: PartialStitch,
): PartialStitch[] {
  const same = stitches.findIndex(
    (s) =>
      s.x === stitch.x &&
      s.y === stitch.y &&
      s.part === stitch.part &&
      s.paletteIndex === stitch.paletteIndex,
  );
  if (same >= 0) return stitches.filter((_, i) => i !== same);
  return [
    ...stitches.filter(
      (s) => !(s.x === stitch.x && s.y === stitch.y && partsOverlap(s.part, stitch.part)),
    ),
    stitch,
  ];
}

/**
 * Removes every partial stitch in the given cells (keys are y * width + x).
 * Returns the same array when nothing was removed.
 */
export function removePartialsInCells(
  stitches: readonly PartialStitch[],
  cells: ReadonlySet<number>,
  width: number,
): readonly PartialStitch[] {
  if (cells.size === 0 || stitches.length === 0) return stitches;
  const kept = stitches.filter((s) => !cells.has(s.y * width + s.x));
  return kept.length === stitches.length ? stitches : kept;
}

const mapParts = (
  stitches: readonly PartialStitch[],
  map: (s: PartialStitch) => { x: number; y: number },
  parts: Readonly<Record<StitchPart, StitchPart>>,
): PartialStitch[] =>
  stitches.map((s) => ({ ...map(s), part: parts[s.part], paletteIndex: s.paletteIndex }));

const FLIP_H: Record<StitchPart, StitchPart> = {
  'half-up': 'half-down',
  'half-down': 'half-up',
  'quarter-tl': 'quarter-tr',
  'quarter-tr': 'quarter-tl',
  'quarter-bl': 'quarter-br',
  'quarter-br': 'quarter-bl',
};

const FLIP_V: Record<StitchPart, StitchPart> = {
  'half-up': 'half-down',
  'half-down': 'half-up',
  'quarter-tl': 'quarter-bl',
  'quarter-bl': 'quarter-tl',
  'quarter-tr': 'quarter-br',
  'quarter-br': 'quarter-tr',
};

/** A quarter turn clockwise: top-left goes to top-right, "/" becomes "\". */
const ROTATE_CW: Record<StitchPart, StitchPart> = {
  'half-up': 'half-down',
  'half-down': 'half-up',
  'quarter-tl': 'quarter-tr',
  'quarter-tr': 'quarter-br',
  'quarter-br': 'quarter-bl',
  'quarter-bl': 'quarter-tl',
};

export function flipPartialsHorizontal(
  stitches: readonly PartialStitch[],
  width: number,
): PartialStitch[] {
  return mapParts(stitches, (s) => ({ x: width - 1 - s.x, y: s.y }), FLIP_H);
}

export function flipPartialsVertical(
  stitches: readonly PartialStitch[],
  height: number,
): PartialStitch[] {
  return mapParts(stitches, (s) => ({ x: s.x, y: height - 1 - s.y }), FLIP_V);
}

/** Matches rotating the cells clockwise: cell (x, y) moves to (height - 1 - y, x). */
export function rotatePartialsClockwise(
  stitches: readonly PartialStitch[],
  height: number,
): PartialStitch[] {
  return mapParts(stitches, (s) => ({ x: height - 1 - s.y, y: s.x }), ROTATE_CW);
}

/** Keeps only stitches that still fit after a resize (top-left anchored, like the cells). */
export function clipPartials(
  stitches: readonly PartialStitch[],
  width: number,
  height: number,
): PartialStitch[] {
  return stitches.filter((s) => s.x < width && s.y < height);
}

/** Applies a palette re-numbering (`remap[old]` = new index, -1 = removed), dropping removed colours. */
export function remapPartials(
  stitches: readonly PartialStitch[],
  remap: Int16Array,
): PartialStitch[] {
  return stitches
    .filter((s) => (remap[s.paletteIndex] ?? -1) >= 0)
    .map((s) => ({ ...s, paletteIndex: remap[s.paletteIndex] }));
}

export function recolorPartials(
  stitches: readonly PartialStitch[],
  from: number,
  to: number,
): PartialStitch[] {
  return stitches.map((s) => (s.paletteIndex === from ? { ...s, paletteIndex: to } : s));
}

export function usedPartialColors(stitches: readonly PartialStitch[]): Set<number> {
  return new Set(stitches.map((s) => s.paletteIndex));
}
