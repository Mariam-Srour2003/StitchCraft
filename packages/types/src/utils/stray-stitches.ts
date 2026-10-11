import { EMPTY_CELL } from '../models/grid';

export interface StrayStitchResult<Row> {
  /** Same row objects where nothing changed, new rows where something did. */
  rows: Row[];
  /** How many stitches were recoloured. */
  changed: number;
}

/**
 * Finds "confetti": stitches with no neighbour of their own colour among the
 * 8 surrounding cells. On a photo conversion these are almost always noise -
 * a single stitch of a thread that costs a start, an end and a thread change
 * for one cross - so each one takes the colour most of its neighbours have.
 *
 * Decisions are made against the original grid, not the grid as it is being
 * changed, so the result doesn't depend on scan order. Empty cells are never
 * filled and never count as a neighbour colour; a lone stitch surrounded only
 * by empty cells is left alone (it was probably placed on purpose).
 *
 * Rows that don't change are returned as the same object, which keeps the
 * editor's "repaint only changed rows" rule working.
 */
export function removeStrayStitches(rows: readonly Int16Array[]): StrayStitchResult<Int16Array> {
  const height = rows.length;
  const out = rows.slice();
  let changed = 0;
  const counts = new Map<number, number>();

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    let copy: Int16Array | null = null;
    for (let x = 0; x < row.length; x++) {
      const color = row[x];
      if (color === EMPTY_CELL) continue;

      counts.clear();
      let sameColor = false;
      for (let dy = -1; dy <= 1 && !sameColor; dy++) {
        const neighbourRow = rows[y + dy];
        if (!neighbourRow) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= neighbourRow.length) continue;
          const neighbour = neighbourRow[nx];
          if (neighbour === color) {
            sameColor = true;
            break;
          }
          if (neighbour !== EMPTY_CELL) counts.set(neighbour, (counts.get(neighbour) ?? 0) + 1);
        }
      }
      if (sameColor || counts.size === 0) continue;

      // Most common neighbour colour; ties go to the lower palette index so
      // the result is deterministic.
      let best = EMPTY_CELL;
      let bestCount = 0;
      for (const [candidate, count] of counts) {
        if (count > bestCount || (count === bestCount && candidate < best)) {
          best = candidate;
          bestCount = count;
        }
      }
      copy ??= Int16Array.from(row);
      copy[x] = best;
      changed++;
    }
    if (copy) out[y] = copy;
  }

  return { rows: out, changed };
}

/** Cells per palette index across decoded rows (-1/empty cells ignored). */
export function countDecodedCells(rows: readonly Int16Array[], paletteLength: number): number[] {
  const counts = new Array<number>(paletteLength).fill(0);
  for (const row of rows) {
    for (let x = 0; x < row.length; x++) {
      const index = row[x];
      if (index >= 0 && index < paletteLength) counts[index]++;
    }
  }
  return counts;
}

/**
 * Re-points every cell through `remap` (old index -> new index, or -1 to
 * empty it). Rows with no affected cell keep their identity.
 */
export function remapCells(rows: readonly Int16Array[], remap: readonly number[]): Int16Array[] {
  return rows.map((row) => {
    let copy: Int16Array | null = null;
    for (let x = 0; x < row.length; x++) {
      const index = row[x];
      if (index < 0) continue;
      const next = remap[index] ?? index;
      if (next !== index) {
        copy ??= Int16Array.from(row);
        copy[x] = next;
      }
    }
    return copy ?? row;
  });
}
