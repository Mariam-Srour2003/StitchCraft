import type { EncodedRow } from '@stitchcraft/types';
import { decodeGrid, encodeGrid } from '@stitchcraft/types';

/** Progress cell values: 1 = stitched, 0 = not yet. */
export const DONE = 1;
export const NOT_DONE = 0;

export function blankProgress(width: number, height: number): Int16Array[] {
  return Array.from({ length: height }, () => new Int16Array(width));
}

/**
 * Stitching progress from a pattern's `meta.progress`. Missing progress, or
 * progress saved for different dimensions, reads as "nothing stitched yet".
 */
export function decodeProgress(
  encoded: EncodedRow[] | undefined,
  width: number,
  height: number,
): Int16Array[] {
  if (!encoded || encoded.length !== height) return blankProgress(width, height);
  return decodeGrid(encoded, width).map((row) => row.map((v) => (v === DONE ? DONE : NOT_DONE)));
}

/** RLE form for saving: done cells as 1, everything else as empty runs. */
export function encodeProgress(progress: readonly Int16Array[]): EncodedRow[] {
  return encodeGrid(progress.map((row) => Array.from(row, (v) => (v === DONE ? DONE : null))));
}
