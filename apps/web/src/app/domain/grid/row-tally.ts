/**
 * Per-color cell counts (and how many of them are marked done) for a grid
 * that is edited a few cells at a time.
 *
 * The editor never mutates a row in place - an edit replaces just the
 * touched rows with new arrays. So counts can be cached per row *object*:
 * after painting one cell only that row is recounted, and the totals are a
 * cheap sum of cached per-row counts instead of a full-grid scan on every
 * pointer move (250,000 cells on a 500x500 pattern).
 */
export interface Tally {
  counts: number[];
  done: number[];
}

interface RowCounts {
  paletteLength: number;
  counts: Int32Array;
}

export class RowTally {
  private readonly rowCounts = new WeakMap<Int16Array, RowCounts>();
  private readonly rowDone = new WeakMap<Int16Array, WeakMap<Int16Array, RowCounts>>();

  /** `progress[y][x] === 1` marks a cell done; progress may be shorter than the grid or empty. */
  tally(
    grid: readonly Int16Array[],
    progress: readonly Int16Array[],
    paletteLength: number,
  ): Tally {
    const counts = new Array<number>(paletteLength).fill(0);
    const done = new Array<number>(paletteLength).fill(0);
    grid.forEach((row, y) => {
      const rowCounts = this.countRow(row, paletteLength);
      for (let i = 0; i < paletteLength; i++) counts[i] += rowCounts[i];
      const progressRow = progress[y];
      if (progressRow) {
        const rowDone = this.doneRow(row, progressRow, paletteLength);
        for (let i = 0; i < paletteLength; i++) done[i] += rowDone[i];
      }
    });
    return { counts, done };
  }

  private countRow(row: Int16Array, paletteLength: number): Int32Array {
    const cached = this.rowCounts.get(row);
    if (cached && cached.paletteLength === paletteLength) return cached.counts;
    const counts = new Int32Array(paletteLength);
    for (let x = 0; x < row.length; x++) {
      const value = row[x];
      if (value >= 0 && value < paletteLength) counts[value]++;
    }
    this.rowCounts.set(row, { paletteLength, counts });
    return counts;
  }

  private doneRow(row: Int16Array, progressRow: Int16Array, paletteLength: number): Int32Array {
    let byProgress = this.rowDone.get(row);
    const cached = byProgress?.get(progressRow);
    if (cached && cached.paletteLength === paletteLength) return cached.counts;
    const counts = new Int32Array(paletteLength);
    for (let x = 0; x < row.length; x++) {
      const value = row[x];
      if (progressRow[x] === 1 && value >= 0 && value < paletteLength) counts[value]++;
    }
    if (!byProgress) {
      byProgress = new WeakMap();
      this.rowDone.set(row, byProgress);
    }
    byProgress.set(progressRow, { paletteLength, counts });
    return counts;
  }
}
