/**
 * A grid row stored as run-length-encoded runs of a palette index (or null for
 * an empty cell). Keeps blank/sparse patterns compact instead of storing one
 * number per cell.
 */
export type EncodedRow = Array<[paletteIndex: number | null, runLength: number]>;

/** -1 sentinel for an empty cell in the decoded flat representation. */
export const EMPTY_CELL = -1;

export function encodeRow(cells: ReadonlyArray<number | null>): EncodedRow {
  const runs: EncodedRow = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    if (last && last[0] === cell) {
      last[1] += 1;
    } else {
      runs.push([cell, 1]);
    }
  }
  return runs;
}

export function decodeRow(row: EncodedRow, width: number): Int16Array {
  const flat = new Int16Array(width).fill(EMPTY_CELL);
  let cursor = 0;
  for (const [paletteIndex, runLength] of row) {
    const value = paletteIndex ?? EMPTY_CELL;
    flat.fill(value, cursor, cursor + runLength);
    cursor += runLength;
  }
  return flat;
}

export function decodeGrid(grid: EncodedRow[], width: number): Int16Array[] {
  return grid.map((row) => decodeRow(row, width));
}

export function encodeGrid(rows: ReadonlyArray<ReadonlyArray<number | null>>): EncodedRow[] {
  return rows.map((row) => encodeRow(row));
}
