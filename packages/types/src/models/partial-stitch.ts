/**
 * Fractional stitches inside one cell, used for smooth curves and fine
 * detail. A half stitch is one diagonal of the cross; a quarter stitch runs
 * from one corner to the centre of the cell.
 *
 * Each part covers some of the cell's four "legs" (corner-to-centre
 * segments): a half stitch covers two opposite legs, a quarter one. Two parts
 * in the same cell may never share a leg - so a cell can hold one half plus
 * up to two quarters on the other diagonal (the classic three-quarter look),
 * or up to four quarters in different colours.
 */
export type StitchPart =
  /** "/" - bottom-left to top-right. */
  | 'half-up'
  /** "\" - top-left to bottom-right. */
  | 'half-down'
  | 'quarter-tl'
  | 'quarter-tr'
  | 'quarter-bl'
  | 'quarter-br';

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface PartialStitch {
  /** Cell column, 0..width-1. */
  x: number;
  /** Cell row, 0..height-1. */
  y: number;
  part: StitchPart;
  paletteIndex: number;
}

export const STITCH_PARTS: readonly StitchPart[] = [
  'half-up',
  'half-down',
  'quarter-tl',
  'quarter-tr',
  'quarter-bl',
  'quarter-br',
];

export const PART_LEGS: Readonly<Record<StitchPart, readonly Corner[]>> = {
  'half-up': ['bl', 'tr'],
  'half-down': ['tl', 'br'],
  'quarter-tl': ['tl'],
  'quarter-tr': ['tr'],
  'quarter-bl': ['bl'],
  'quarter-br': ['br'],
};

export function isHalf(part: StitchPart): boolean {
  return part === 'half-up' || part === 'half-down';
}

/** True when two parts of the same cell would overlap. */
export function partsOverlap(a: StitchPart, b: StitchPart): boolean {
  return PART_LEGS[a].some((leg) => PART_LEGS[b].includes(leg));
}

/**
 * Thread used, as a fraction of a full cross stitch: a half stitch is one of
 * the cross's two diagonals; a quarter stitch is half a diagonal.
 */
export const PART_THREAD: Readonly<Record<'half' | 'quarter', number>> = {
  half: 0.5,
  quarter: 0.25,
};

export function partThread(part: StitchPart): number {
  return isHalf(part) ? PART_THREAD.half : PART_THREAD.quarter;
}

/**
 * Per palette index, the thread the partial stitches use, in full-stitch
 * equivalents - add it to the full-stitch count before estimating skeins.
 */
export function partialThreadByIndex(
  stitches: readonly PartialStitch[] | undefined,
  paletteLength: number,
): number[] {
  const totals = new Array<number>(paletteLength).fill(0);
  for (const s of stitches ?? []) {
    if (s.paletteIndex >= 0 && s.paletteIndex < paletteLength) {
      totals[s.paletteIndex] += partThread(s.part);
    }
  }
  return totals;
}

/** Number of partial stitches per palette index. */
export function partialCountByIndex(
  stitches: readonly PartialStitch[] | undefined,
  paletteLength: number,
): number[] {
  const counts = new Array<number>(paletteLength).fill(0);
  for (const s of stitches ?? []) {
    if (s.paletteIndex >= 0 && s.paletteIndex < paletteLength) counts[s.paletteIndex]++;
  }
  return counts;
}

/** Upper bound on partial stitches per pattern; bounds request size and render cost. */
export const MAX_PARTIAL_STITCHES = 50_000;

/**
 * Checks a partial-stitch list against its pattern: cells inside the grid, a
 * known part, an existing palette colour, no two parts overlapping in one
 * cell, and at most MAX_PARTIAL_STITCHES. Returns a readable problem or null.
 */
export function findPartialStitchProblem(
  stitches: unknown,
  width: number,
  height: number,
  paletteLength: number,
): string | null {
  if (!Array.isArray(stitches)) return 'partial stitches must be an array';
  if (stitches.length > MAX_PARTIAL_STITCHES) {
    return `too many partial stitches (${stitches.length}, max ${MAX_PARTIAL_STITCHES})`;
  }
  const legsByCell = new Map<number, Set<Corner>>();
  for (let i = 0; i < stitches.length; i++) {
    const s = stitches[i] as Partial<Record<keyof PartialStitch, unknown>> | null;
    if (!s || typeof s !== 'object') return `partial stitch ${i} is not an object`;
    const { x, y, part, paletteIndex } = s;
    if (!Number.isInteger(x) || !Number.isInteger(y))
      return `partial stitch ${i} has a non-integer cell`;
    if (
      (x as number) < 0 ||
      (x as number) >= width ||
      (y as number) < 0 ||
      (y as number) >= height
    ) {
      return `partial stitch ${i} is outside the ${width}x${height} grid`;
    }
    if (!STITCH_PARTS.includes(part as StitchPart))
      return `partial stitch ${i} has an unknown part`;
    if (
      !Number.isInteger(paletteIndex) ||
      (paletteIndex as number) < 0 ||
      (paletteIndex as number) >= paletteLength
    ) {
      return `partial stitch ${i} uses palette index ${String(paletteIndex)}, but the palette has ${paletteLength} colors`;
    }
    const key = (y as number) * width + (x as number);
    const legs = legsByCell.get(key) ?? new Set<Corner>();
    for (const leg of PART_LEGS[part as StitchPart]) {
      if (legs.has(leg)) return `partial stitch ${i} overlaps another in cell (${x}, ${y})`;
      legs.add(leg);
    }
    legsByCell.set(key, legs);
  }
  return null;
}

/**
 * Where a part is drawn inside its cell, as [x1, y1, x2, y2] in fractions of
 * the cell (0,0 top-left .. 1,1 bottom-right). Quarters run corner to centre.
 */
export const PART_SEGMENT: Readonly<Record<StitchPart, readonly [number, number, number, number]>> =
  {
    'half-up': [0, 1, 1, 0],
    'half-down': [0, 0, 1, 1],
    'quarter-tl': [0, 0, 0.5, 0.5],
    'quarter-tr': [1, 0, 0.5, 0.5],
    'quarter-bl': [0, 1, 0.5, 0.5],
    'quarter-br': [1, 1, 0.5, 0.5],
  };
