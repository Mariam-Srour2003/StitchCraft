import { decodeGrid, Pattern } from '@stitchcraft/types';

/** Stitch/drill count per palette index, in palette order. Shared by the materials list and PDF legend. */
export function countPaletteUsage(pattern: Pattern): number[] {
  const decoded = decodeGrid(pattern.grid, pattern.width);
  const counts = new Array(pattern.palette.length).fill(0);
  for (const row of decoded) {
    for (const value of row) {
      if (value >= 0 && value < counts.length) counts[value]++;
    }
  }
  return counts;
}
