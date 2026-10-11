/**
 * Shopping-quantity estimates: how many skeins of floss (cross-stitch) or bags
 * of drills (diamond painting) a given stitch/drill count needs. Shared by the
 * editor legend and the server-side materials CSV so both always agree.
 *
 * Cross-stitch model (documented so the numbers can be audited/tuned):
 * - One full cross on fabric with `count` stitches/inch has a cell side
 *   s = 2.54 / count cm. Each pass of thread covers two front diagonals
 *   (2 * s * sqrt(2)) plus roughly two cell-sides of travel on the back
 *   (2 * s): ~4.83 * s cm of thread *path* per stitch.
 * - That path is stitched with `strands` strands at once, pulled from a
 *   standard 6-strand, 8 m DMC skein (4800 strand-cm per skein).
 * - 30% is reserved for waste (thread tails, travelling between areas,
 *   re-threading), so 70% of the skein becomes stitches.
 * At 14-count with 2 strands this gives ~1900 stitches per skein, in line
 * with the common "about 1800-2000 stitches a skein" rule of thumb.
 *
 * Diamond-painting model: 10% spare drills (they get lost and some are
 * misshapen), sold in bags of 200.
 */

export const SKEIN_LENGTH_CM = 800;
export const SKEIN_STRANDS = 6;
export const THREAD_WASTE_FRACTION = 0.3;
export const DRILL_SPARE_FRACTION = 0.1;
export const DRILLS_PER_BAG = 200;

const THREAD_PATH_PER_CELL_SIDE = 2 * Math.SQRT2 + 2;

/** The usual strand count for a given Aida count: 3 on coarse fabric, 1 on very fine. */
export function defaultStrandsForCount(fabricCount: number): number {
  if (fabricCount <= 11) return 3;
  if (fabricCount <= 18) return 2;
  return 1;
}

/** Full cross stitches one skein covers, after the waste allowance. */
export function stitchesPerSkein(
  fabricCount: number,
  strands = defaultStrandsForCount(fabricCount),
): number {
  const cellSideCm = 2.54 / fabricCount;
  const strandCmPerStitch = THREAD_PATH_PER_CELL_SIDE * cellSideCm * strands;
  const usableStrandCm = SKEIN_LENGTH_CM * SKEIN_STRANDS * (1 - THREAD_WASTE_FRACTION);
  return Math.floor(usableStrandCm / strandCmPerStitch);
}

export function skeinsNeeded(stitchCount: number, fabricCount: number, strands?: number): number {
  if (stitchCount <= 0) return 0;
  return Math.ceil(stitchCount / stitchesPerSkein(fabricCount, strands));
}

export function drillBagsNeeded(drillCount: number): number {
  if (drillCount <= 0) return 0;
  return Math.ceil((drillCount * (1 + DRILL_SPARE_FRACTION)) / DRILLS_PER_BAG);
}

export interface MaterialEstimate {
  quantity: number;
  unit: 'skein' | 'bag';
}

/**
 * Estimate for one palette color. `null` for color-by-number, which is
 * painted rather than stitched or drilled, so there's no unit to buy by count.
 */
export function estimateMaterial(
  type: 'cross_stitch' | 'color_by_number' | 'diamond',
  count: number,
  options: { fabricCount?: number; strands?: number; backstitchLength?: number } = {},
): MaterialEstimate | null {
  if (type === 'diamond') return { quantity: drillBagsNeeded(count), unit: 'bag' };
  if (type === 'cross_stitch') {
    const fabricCount = options.fabricCount ?? 14;
    // Cross stitches and backstitch in the same color come off the same skeins,
    // so their fractions are added before rounding up once.
    const skeins =
      skeinFraction(count, fabricCount, options.strands) +
      backstitchSkeinFraction(options.backstitchLength ?? 0, fabricCount);
    // The epsilon absorbs float noise so an exact skein doesn't round up to two.
    return { quantity: skeins <= 0 ? 0 : Math.ceil(skeins - 1e-9), unit: 'skein' };
  }
  return null;
}

/**
 * Unrounded skeins for a stitch count - for adding up one thread's needs
 * across several patterns (possibly on different fabrics) before rounding
 * up once, instead of rounding each pattern up separately.
 */
export function skeinFraction(stitchCount: number, fabricCount: number, strands?: number): number {
  if (stitchCount <= 0) return 0;
  return stitchCount / stitchesPerSkein(fabricCount, strands);
}

/** Column header for shopping quantities by pattern type; null when the type isn't bought by count. */
export function materialColumnLabel(
  type: 'cross_stitch' | 'color_by_number' | 'diamond',
): 'Skeins' | 'Drill bags' | null {
  if (type === 'diamond') return 'Drill bags';
  if (type === 'cross_stitch') return 'Skeins';
  return null;
}

/**
 * Thread for backstitch, as an unrounded skein fraction. A backstitch line
 * uses about three times its length in thread (the front line plus
 * overlapping double-length stitches on the back), usually with a single
 * strand; the same 30% waste allowance as cross stitches applies.
 */
export const BACKSTITCH_THREAD_FACTOR = 3;

export function backstitchSkeinFraction(
  lengthInCells: number,
  fabricCount: number,
  strands = 1,
): number {
  if (lengthInCells <= 0) return 0;
  const strandCm = (lengthInCells * 2.54 * BACKSTITCH_THREAD_FACTOR * strands) / fabricCount;
  const usableStrandCm = SKEIN_LENGTH_CM * SKEIN_STRANDS * (1 - THREAD_WASTE_FRACTION);
  return strandCm / usableStrandCm;
}
