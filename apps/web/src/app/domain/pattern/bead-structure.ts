import { EMPTY_CELL } from '@stitchcraft/types';

export interface BeadStructure {
  /**
   * Beads with no bead directly above, below, left or right. Ironing fuses
   * beads only where their sides touch, so these fall off - including beads
   * that only meet others at a corner. Top-to-bottom, left-to-right order.
   */
  loose: { x: number; y: number }[];
  /** How many separate pieces the design irons into (side-connected groups of beads). */
  pieces: number;
}

/**
 * Checks whether a fuse-bead design will hold together once ironed. Pure,
 * one pass over the grid plus a flood fill, so it can run on every edit.
 */
export function beadStructure(
  rows: readonly (Int16Array | readonly number[])[],
  width: number,
  height: number,
): BeadStructure {
  const filled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && rows[y][x] !== EMPTY_CELL;

  const loose: { x: number; y: number }[] = [];
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  let pieces = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!filled(x, y)) continue;
      if (!filled(x - 1, y) && !filled(x + 1, y) && !filled(x, y - 1) && !filled(x, y + 1)) {
        loose.push({ x, y });
      }
      if (seen[y * width + x]) continue;
      pieces++;
      seen[y * width + x] = 1;
      stack.push(y * width + x);
      while (stack.length) {
        const i = stack.pop() as number;
        const cx = i % width;
        const cy = (i - cx) / width;
        for (const [nx, ny] of [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ]) {
          if (!filled(nx, ny) || seen[ny * width + nx]) continue;
          seen[ny * width + nx] = 1;
          stack.push(ny * width + nx);
        }
      }
    }
  }
  return { loose, pieces };
}
