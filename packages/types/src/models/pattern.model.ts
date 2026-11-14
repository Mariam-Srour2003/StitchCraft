import type { Backstitch } from './backstitch';
import type { EncodedRow } from './grid';
import type { PartialStitch } from './partial-stitch';
import type { PaletteEntry } from './palette.model';

export type PatternType = 'cross_stitch' | 'color_by_number' | 'diamond' | 'fuse_bead';

/** Every pattern type, in the order screens list them. */
export const PATTERN_TYPE_VALUES: readonly PatternType[] = [
  'cross_stitch',
  'color_by_number',
  'diamond',
  'fuse_bead',
];

/** Pegs along one side of a standard square pegboard for 5 mm beads (29 x 29). */
export const DEFAULT_BOARD_PEGS = 29;

export interface PatternMeta {
  /** Aida fabric count (stitches per inch), cross-stitch/color-by-number only. */
  fabricCount?: number;
  /** Physical drill size in millimetres, diamond painting only (typically 2.5-2.8mm). */
  drillSizeMm?: number;
  /** Fuse beads only: which bead line the palette comes from (a BeadCatalogue id, e.g. 'hama-midi'). */
  beadCatalogueId?: string;
  /** Fuse beads only: pegs along one side of the square pegboard the design is split across. */
  boardPegs?: number;
  createdFrom: 'blank' | 'conversion';
  sourceConversionJobId?: string;
  /** What the converter's cleanup step changed, for patterns made from a photo. */
  conversionCleanup?: {
    strayStitchesRemoved: number;
    colorsMerged: number;
    regionsMerged?: number;
  };
  /**
   * Stitching progress: which cells the stitcher has marked done, RLE-encoded
   * like the grid (1 = done, null = not yet). Optional; absent or mismatched
   * dimensions mean "nothing stitched yet".
   */
  progress?: EncodedRow[];
  /** Outline stitches drawn over the grid. Optional; absent means none. */
  backstitches?: Backstitch[];
  /** Half and quarter stitches. Optional; absent means none. */
  partialStitches?: PartialStitch[];
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
