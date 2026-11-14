import type { Pattern } from '@hobbygrid/types';
import { countCellsByIndex } from '@hobbygrid/types';

/** Stitch/drill count per palette index, in palette order. Shared by the materials list and PDF legend. */
export function countPaletteUsage(pattern: Pattern): number[] {
  return countCellsByIndex(pattern.grid, pattern.palette.length);
}
