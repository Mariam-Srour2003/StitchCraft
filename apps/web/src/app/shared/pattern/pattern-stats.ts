import type { Pattern } from '@stitchcraft/types';
import { decodeGrid } from '@stitchcraft/types';

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

/** Counts and stitching progress for a pattern, decoded from its RLE grid and `meta.progress`. */
export function patternStats(pattern: Pattern): PatternStats {
  const grid = decodeGrid(pattern.grid, pattern.width);
  const progress =
    pattern.meta.progress && pattern.meta.progress.length === pattern.height
      ? decodeGrid(pattern.meta.progress, pattern.width)
      : null;
  const perColor = new Array(pattern.palette.length).fill(0);
  let total = 0;
  let done = 0;
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const value = row[x];
      if (value < 0) continue;
      total++;
      if (value < perColor.length) perColor[value]++;
      if (progress?.[y][x] === 1) done++;
    }
  });
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.floor((done / total) * 100),
    colorsUsed: perColor.filter((n) => n > 0).length,
    perColor,
  };
}

/** Hours of stitching left at a given speed, rounded up to the nearest half hour. */
export function hoursRemaining(stats: PatternStats, stitchesPerHour: number): number {
  const remaining = stats.total - stats.done;
  if (remaining <= 0 || stitchesPerHour <= 0) return 0;
  return Math.ceil((remaining / stitchesPerHour) * 2) / 2;
}

export const PATTERN_TYPE_LABELS: Record<Pattern['type'], string> = {
  cross_stitch: 'Cross-stitch',
  color_by_number: 'Paint by number',
  diamond: 'Diamond painting',
};
