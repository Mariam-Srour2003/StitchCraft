import type { EncodedRow, Pattern } from '@stitchcraft/types';
import { countCellsByIndex } from '@stitchcraft/types';

export interface PatternStats {
  /** Painted cells (stitches / drills / painted squares). */
  total: number;
  /** Of those, marked done in stitching mode. */
  done: number;
  percent: number;
  /** Palette colors actually used by at least one cell. */
  colorsUsed: number;
  /** Count per palette index, in palette order. */
  perColor: number[];
}

/**
 * Counts and stitching progress for a pattern, computed directly on the RLE
 * runs (no decoding to cell arrays), so a dashboard full of large patterns
 * stays cheap.
 */
export function patternStats(pattern: Pattern): PatternStats {
  const perColor = countCellsByIndex(pattern.grid, pattern.palette.length);
  const total = perColor.reduce((sum, n) => sum + n, 0);
  const progress = pattern.meta.progress;
  let done = 0;
  if (progress && progress.length === pattern.height) {
    pattern.grid.forEach((row, y) => {
      done += countDoneInRow(row, progress[y], pattern.palette.length);
    });
  }
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.floor((done / total) * 100),
    colorsUsed: perColor.filter((n) => n > 0).length,
    perColor,
  };
}

/**
 * Painted cells in a row that are also marked done, by walking both rows'
 * runs in step (two pointers) and adding the overlap of each painted run with
 * each done run.
 */
function countDoneInRow(
  gridRow: EncodedRow,
  progressRow: EncodedRow,
  paletteLength: number,
): number {
  let done = 0;
  let g = 0;
  let p = 0;
  let gLeft = gridRow[0]?.[1] ?? 0;
  let pLeft = progressRow[0]?.[1] ?? 0;
  while (g < gridRow.length && p < progressRow.length) {
    const step = Math.min(gLeft, pLeft);
    const index = gridRow[g][0];
    const painted = index !== null && index >= 0 && index < paletteLength;
    if (painted && progressRow[p][0] === 1) done += step;
    gLeft -= step;
    pLeft -= step;
    if (gLeft === 0 && ++g < gridRow.length) gLeft = gridRow[g][1];
    if (pLeft === 0 && ++p < progressRow.length) pLeft = progressRow[p][1];
  }
  return done;
}

/** Hours of stitching left at a given speed, rounded up to the nearest half hour. */
export function hoursRemaining(stats: PatternStats, stitchesPerHour: number): number {
  const remaining = stats.total - stats.done;
  if (remaining <= 0 || stitchesPerHour <= 0) return 0;
  return Math.ceil((remaining / stitchesPerHour) * 2) / 2;
}
