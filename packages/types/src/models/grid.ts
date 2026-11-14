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

/** Largest width/height a pattern may have - the editor, converter and API all enforce this. */
export const MAX_PATTERN_DIMENSION = 500;

/**
 * Checks an RLE grid against the pattern it belongs to: one row per line of
 * height, every row's runs summing to exactly `width`, positive integer run
 * lengths, and palette indices that exist. Returns a human-readable problem,
 * or null when the grid is valid. Shared by the API (rejecting bad saves)
 * and anything else that receives grids from outside.
 */
export function findGridProblem(
  grid: unknown,
  width: number,
  height: number,
  paletteLength: number,
): string | null {
  if (!Array.isArray(grid)) return 'grid must be an array of rows';
  if (grid.length !== height) return `grid has ${grid.length} rows, expected ${height}`;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    if (!Array.isArray(row)) return `row ${y} must be an array of runs`;
    let cells = 0;
    for (const run of row) {
      if (!Array.isArray(run) || run.length !== 2) return `row ${y} has a malformed run`;
      const [index, length] = run as [unknown, unknown];
      if (!Number.isInteger(length) || (length as number) < 1) {
        return `row ${y} has an invalid run length`;
      }
      if (
        index !== null &&
        (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= paletteLength)
      ) {
        return `row ${y} uses palette index ${String(index)}, but the palette has ${paletteLength} colors`;
      }
      cells += length as number;
    }
    if (cells !== width) return `row ${y} covers ${cells} cells, expected ${width}`;
  }
  return null;
}

/**
 * Cells per palette index, counted straight from RLE runs (no decoding), so
 * it's cheap even for large patterns. Indices outside the palette are ignored.
 */
export function countCellsByIndex(grid: readonly EncodedRow[], paletteLength: number): number[] {
  const counts = new Array<number>(paletteLength).fill(0);
  for (const row of grid) {
    for (const [index, length] of row) {
      if (index !== null && index >= 0 && index < paletteLength) counts[index] += length;
    }
  }
  return counts;
}
