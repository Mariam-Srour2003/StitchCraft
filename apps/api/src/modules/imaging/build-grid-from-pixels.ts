import {
  assignSymbols,
  DMC_COLORS,
  kMeansQuantize,
  nearestColorIndex,
  nearestDmc,
  srgbToLab,
} from '@stitchcraft/color';
import { DmcColor, EncodedRow, PaletteEntry, Rgb, encodeGrid } from '@stitchcraft/types';

export interface BuildGridResult {
  palette: PaletteEntry[];
  grid: EncodedRow[];
}

/**
 * The deterministic core of image conversion: quantize -> DMC-match ->
 * dedupe -> assign symbols -> build the grid. Pure (no sharp/I-O), so it's
 * unit-testable against synthetic pixel arrays instead of real image files.
 * `ImagingService.convertImageToGrid` wraps this with the sharp-based pixel
 * extraction step.
 */
export function buildGridFromPixels(
  pixels: readonly Rgb[],
  width: number,
  height: number,
  colorCount: number,
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
  const finalColors: DmcColor[] = [];
  const centroidToFinalIndex = dmcMatches.map((dmc) => {
    let index = codeToFinalIndex.get(dmc.code);
    if (index === undefined) {
      index = finalColors.length;
      codeToFinalIndex.set(dmc.code, index);
      finalColors.push(dmc);
    }
    return index;
  });

  const symbols = assignSymbols(finalColors.length);
  const palette: PaletteEntry[] = finalColors.map((color, index) => ({ index, symbol: symbols[index], color }));

  const rows: Array<Array<number | null>> = [];
  for (let y = 0; y < height; y++) {
    const row: Array<number | null> = [];
    for (let x = 0; x < width; x++) {
      const centroidIndex = nearestColorIndex(srgbToLab(pixels[y * width + x]), quantizedLabs);
      row.push(centroidToFinalIndex[centroidIndex]);
    }
    rows.push(row);
  }

  return { palette, grid: encodeGrid(rows) };
}
