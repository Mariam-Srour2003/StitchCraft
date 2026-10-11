import type { Backstitch } from './backstitch';
import type { EncodedRow } from './grid';
import type { PaletteEntry } from './palette.model';

export type PatternType = 'cross_stitch' | 'color_by_number' | 'diamond';

export interface PatternMeta {
  /** Aida fabric count (stitches per inch), cross-stitch/color-by-number only. */
  fabricCount?: number;
  /** Physical drill size in millimetres, diamond painting only (typically 2.5-2.8mm). */
  drillSizeMm?: number;
  createdFrom: 'blank' | 'conversion';
  sourceConversionJobId?: string;
  /** What the converter's cleanup step changed, for patterns made from a photo. */
  conversionCleanup?: { strayStitchesRemoved: number; colorsMerged: number };
  /**
   * Stitching progress: which cells the stitcher has marked done, RLE-encoded
   * like the grid (1 = done, null = not yet). Optional; absent or mismatched
   * dimensions mean "nothing stitched yet".
   */
  progress?: EncodedRow[];
  /** Outline stitches drawn over the grid. Optional; absent means none. */
  backstitches?: Backstitch[];
}

export interface Pattern {
  id: string;
  projectId: string;
  name: string;
  type: PatternType;
  width: number;
  height: number;
  palette: PaletteEntry[];
  grid: EncodedRow[];
  meta: PatternMeta;
  createdAt: string;
  updatedAt: string;
}
