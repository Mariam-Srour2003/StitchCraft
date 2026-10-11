import {
  assignSymbols,
  createNearestColorMatcher,
  DMC_COLORS,
  kMeansQuantize,
  nearestDmc,
  planRareColorMerge,
  srgbToLab,
} from '@stitchcraft/color';
import type { DmcColor, EncodedRow, PaletteEntry, Rgb } from '@stitchcraft/types';
import {
  countDecodedCells,
  EMPTY_CELL,
  encodeRow,
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
}

export interface CleanupReport {
  strayStitchesRemoved: number;
  colorsMerged: number;
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
 * The deterministic core of image conversion: quantize -> DMC-match ->
 * dedupe -> (cleanup) -> assign symbols -> build the grid. Pure (no
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

  const quantized = kMeansQuantize(pixels, colorCount);
  const quantizedLabs = quantized.map(srgbToLab);
  const dmcMatches = quantized.map((c) => nearestDmc(c, DMC_COLORS).color);

  // Two quantized centroids can snap to the same real DMC thread; dedupe so
  // the legend/grid doesn't carry a redundant entry for the same color.
  const codeToFinalIndex = new Map<string, number>();
  let colors: DmcColor[] = [];
  const centroidToFinalIndex = dmcMatches.map((dmc) => {
    let index = codeToFinalIndex.get(dmc.code);
    if (index === undefined) {
      index = colors.length;
      codeToFinalIndex.set(dmc.code, index);
      colors.push(dmc);
    }
    return index;
  });

  const nearestCentroid = createNearestColorMatcher(quantizedLabs, srgbToLab);
  let rows: Int16Array[] = [];
  for (let y = 0; y < height; y++) {
    const row = new Int16Array(width);
    for (let x = 0; x < width; x++) {
      const centroidIndex = nearestCentroid(pixels[y * width + x]);
      row[x] = centroidToFinalIndex[centroidIndex];
    }
    rows.push(row);
  }

  let cleanup: CleanupReport | undefined;
  if (options.cleanup) {
    const stray = removeStrayStitches(rows);
    rows = stray.rows;

    const counts = countDecodedCells(rows, colors.length);
    const merge = planRareColorMerge(
      colors.map((c) => c.lab),
      counts,
      minCellsPerColor(width * height),
    );
    const colorsMerged = merge.filter((target, index) => target !== index).length;
    rows = remapCells(rows, merge);
    cleanup = { strayStitchesRemoved: stray.changed, colorsMerged };
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
