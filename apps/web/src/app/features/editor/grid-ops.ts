/**
 * Pure, framework-free grid operations used by `EditorStore`. Kept separate
 * so the algorithms can be unit-tested without Angular or signals.
 */

export interface CellChange {
  x: number;
  y: number;
  before: number;
  after: number;
}

/**
 * 4-connected flood fill starting at (x, y): every cell reachable through
 * orthogonal neighbours that holds the same value as the start cell is
 * replaced with `target`. Returns the list of changes without mutating
 * `grid`; an empty list means nothing would change (out of bounds, or the
 * region already holds `target`).
 *
 * Iterative scanline-free stack walk: bounded by grid size (max 500x500 in
 * the editor), so no recursion-depth risk.
 */
export function floodFill(
  grid: readonly (Int16Array | readonly number[])[],
  x: number,
  y: number,
  target: number,
): CellChange[] {
  const height = grid.length;
  if (y < 0 || y >= height) return [];
  const width = grid[y].length;
  if (x < 0 || x >= width) return [];

  const source = grid[y][x];
  if (source === target) return [];

  const visited = new Uint8Array(width * height);
  const changes: CellChange[] = [];
  const stack: number[] = [y * width + x];
  visited[y * width + x] = 1;

  while (stack.length > 0) {
    const key = stack.pop() as number;
    const cx = key % width;
    const cy = (key - cx) / width;
    changes.push({ x: cx, y: cy, before: source, after: target });

    const neighbours: [number, number][] = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nKey = ny * width + nx;
      if (visited[nKey]) continue;
      if (grid[ny][nx] !== source) continue;
      visited[nKey] = 1;
      stack.push(nKey);
    }
  }

  return changes;
}

/**
 * Applies a batch of cell changes in one pass, copying only the rows that
 * actually change so `grid-canvas` can keep skipping untouched rows by
 * reference. `pick` selects which side of each change to write.
 */
export function applyChanges(
  grid: readonly Int16Array[],
  changes: readonly CellChange[],
  pick: 'before' | 'after',
): Int16Array[] {
  const next = grid.slice();
  const copied = new Set<number>();
  for (const change of changes) {
    if (!copied.has(change.y)) {
      next[change.y] = next[change.y].slice();
      copied.add(change.y);
    }
    next[change.y][change.x] = change[pick];
  }
  return next;
}

/** Rebuilds a grid at new dimensions, preserving overlapping (top-left anchored) cells. */
export function resizeGrid(
  grid: readonly Int16Array[],
  oldWidth: number,
  newWidth: number,
  newHeight: number,
  emptyValue: number,
): Int16Array[] {
  return Array.from({ length: newHeight }, (_, y) => {
    const row = new Int16Array(newWidth).fill(emptyValue);
    const oldRow = grid[y];
    if (oldRow) row.set(oldRow.subarray(0, Math.min(newWidth, oldWidth)));
    return row;
  });
}

/** Mirror the whole pattern left-to-right. */
export function flipHorizontal(grid: readonly Int16Array[]): Int16Array[] {
  return grid.map((row) => row.slice().reverse());
}

/** Mirror the whole pattern top-to-bottom. */
export function flipVertical(grid: readonly Int16Array[]): Int16Array[] {
  return grid.slice().reverse();
}

/** Rotate a width x height grid 90 degrees clockwise into a height x width grid. */
export function rotateClockwise(
  grid: readonly Int16Array[],
  width: number,
  height: number,
): Int16Array[] {
  return Array.from({ length: width }, (_, newY) => {
    const row = new Int16Array(height);
    for (let newX = 0; newX < height; newX++) row[newX] = grid[height - 1 - newX][newY];
    return row;
  });
}

/** Every cell of color `from` becomes `to` (a palette-wide recolor). */
export function replaceValue(
  grid: readonly (Int16Array | readonly number[])[],
  from: number,
  to: number,
): CellChange[] {
  if (from === to) return [];
  const changes: CellChange[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === from) changes.push({ x, y, before: from, after: to });
    }
  });
  return changes;
}

/**
 * Drops palette entries no cell uses and re-numbers the rest (keeping their
 * order and symbols), rewriting the grid to the new indices. `remap[old]` is
 * the new index, or -1 for a removed entry.
 */
export function compactPalette<T extends { index: number }>(
  palette: readonly T[],
  grid: readonly Int16Array[],
): { palette: T[]; grid: Int16Array[]; remap: Int16Array } {
  const used = new Uint8Array(palette.length);
  for (const row of grid) {
    for (const value of row) if (value >= 0 && value < used.length) used[value] = 1;
  }
  const remap = new Int16Array(palette.length).fill(-1);
  const nextPalette: T[] = [];
  palette.forEach((entry, i) => {
    if (!used[i]) return;
    remap[i] = nextPalette.length;
    nextPalette.push({ ...entry, index: nextPalette.length });
  });
  const nextGrid = grid.map((row) => row.map((v) => (v >= 0 && v < remap.length ? remap[v] : v)));
  return { palette: nextPalette, grid: nextGrid, remap };
}
