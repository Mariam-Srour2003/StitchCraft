import {
  assignSymbols,
  createNearestColorMatcher,
  DMC_COLORS,
  fillPalette,
  kMeansQuantize,
  labHistogram,
  nearestDmc,
  planRareColorMerge,
  srgbToLab,
} from '@stitchcraft/color';
import type { DmcColor, EncodedRow, PaletteEntry, Rgb } from '@stitchcraft/types';
import {
  countDecodedCells,
  EMPTY_CELL,
  encodeRow,
  mergeSmallRegions,
  remapCells,
  removeStrayStitches,
} from '@stitchcraft/types';

export interface BuildGridOptions {
  /**
   * Tidy the result the way a stitcher would by hand: recolour lone
   * "confetti" stitches, then fold colours used for only a handful of
   * stitches into their closest common colour.
   */
  cleanup?: boolean;
  /**
   * With cleanup, also repaint areas smaller than this many cells into a
   * neighbour - paint by number needs areas big enough to paint.
   */
  minRegionSize?: number;
}

export interface CleanupReport {
  strayStitchesRemoved: number;
  colorsMerged: number;
  /** Paint by number only: tiny areas repainted into a neighbour. */
  regionsMerged?: number;
}

export interface BuildGridResult {
  palette: PaletteEntry[];
  grid: EncodedRow[];
  /** Present when cleanup ran. */
  cleanup?: CleanupReport;
}

/**
 * A colour needs at least this share of the pattern (and at least
 * MIN_CELLS_FLOOR stitches) to keep its own thread during cleanup.
 */
const RARE_COLOR_SHARE = 0.002;
const MIN_CELLS_FLOOR = 4;

export function minCellsPerColor(cellCount: number): number {
  return Math.max(MIN_CELLS_FLOOR, Math.round(cellCount * RARE_COLOR_SHARE));
}

/**
 * Smallest paint-by-number area worth keeping: 4 cells on patterns up to
 * 100x100, growing with size so a big canvas isn't mostly tiny areas.
 */
export function minPaintAreaCells(cellCount: number): number {
  return Math.max(4, Math.round(cellCount / 2500));
}

/**
 * Picks up to `colorCount` DMC threads for these pixels: k-means finds the
 * image's main colours, each snaps to its nearest thread, and when two snap
 * to the same thread the palette is topped back up with the threads that
 * reduce the colour error most (fillPalette). Before the top-up, asking for
 * 30 colours delivered about 22 on photos. Fewer come back only when more
 * would not change the picture, e.g. a six-colour logo.
 */
export function chooseThreads(pixels: readonly Rgb[], colorCount: number): DmcColor[] {
  const snapped: DmcColor[] = [];
  for (const centre of kMeansQuantize(pixels, colorCount)) {
    const thread = nearestDmc(centre, DMC_COLORS).color;
    if (!snapped.includes(thread)) snapped.push(thread);
  }
  if (snapped.length >= colorCount) return snapped;
  return fillPalette(labHistogram(pixels, srgbToLab), snapped, DMC_COLORS, colorCount);
}

/**
 * The deterministic core of image conversion: choose threads (quantize ->
 * DMC-match -> dedupe -> top up) -> map pixels to threads ->
 * (cleanup) -> assign symbols -> build the grid. Pure (no
 * sharp/I-O), so it's unit-testable against synthetic pixel arrays instead of
 * real image files. `ImagingService.convertImageToGrid` wraps this with the
 * sharp-based pixel extraction step.
 */
export function buildGridFromPixels(
  pixels: readonly Rgb[],
  width: number,
  height: number,
  colorCount: number,
  options: BuildGridOptions = {},
): BuildGridResult {
  if (pixels.length !== width * height) {
    throw new Error(`buildGridFromPixels: expected ${width * height} pixels, got ${pixels.length}`);
  }

  let colors = chooseThreads(pixels, colorCount);

  // Every pixel goes to its nearest *thread*. (It used to go to its nearest
  // k-means centre and inherit that centre's thread, which misplaces pixels
  // whenever a centre sits between two threads.)
  const nearestThread = createNearestColorMatcher(
    colors.map((c) => c.lab),
    srgbToLab,
  );
  let rows: Int16Array[] = [];
  for (let y = 0; y < height; y++) {
    const row = new Int16Array(width);
    for (let x = 0; x < width; x++) {
      row[x] = nearestThread(pixels[y * width + x]);
    }
    rows.push(row);
  }

  let cleanup: CleanupReport | undefined;
  if (options.cleanup) {
    const stray = removeStrayStitches(rows);
    rows = stray.rows;
    let regionsMerged: number | undefined;
    if (options.minRegionSize) {
      const regions = mergeSmallRegions(rows, options.minRegionSize);
      rows = regions.rows;
      regionsMerged = regions.merged;
    }

    const counts = countDecodedCells(rows, colors.length);
    const merge = planRareColorMerge(
      colors.map((c) => c.lab),
      counts,
      minCellsPerColor(width * height),
    );
    const colorsMerged = merge.filter((target, index) => target !== index).length;
    rows = remapCells(rows, merge);
    cleanup = {
      strayStitchesRemoved: stray.changed,
      colorsMerged,
      ...(regionsMerged !== undefined ? { regionsMerged } : {}),
    };
  }

  // Drop colours nothing uses any more (after dedupe or cleanup) and number
  // the rest 0..n-1 in their original order.
  const counts = countDecodedCells(rows, colors.length);
  const compact = new Array<number>(colors.length).fill(EMPTY_CELL);
  const kept: DmcColor[] = [];
  colors.forEach((color, index) => {
    if (counts[index] > 0) {
      compact[index] = kept.length;
      kept.push(color);
    }
  });
  rows = remapCells(rows, compact);
  colors = kept;

  const symbols = assignSymbols(colors.length);
  const palette: PaletteEntry[] = colors.map((color, index) => ({
    index,
    symbol: symbols[index],
    color,
  }));

  const grid = rows.map((row) => encodeRow(Array.from(row, (v) => (v === EMPTY_CELL ? null : v))));
  return cleanup ? { palette, grid, cleanup } : { palette, grid };
}
