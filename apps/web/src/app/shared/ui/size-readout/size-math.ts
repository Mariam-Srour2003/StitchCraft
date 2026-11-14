import type { PatternType } from '@hobbygrid/types';

export interface FinishedSize {
  inches: { width: number; height: number };
  cm: { width: number; height: number };
}

const MM_PER_INCH = 25.4;

/**
 * Finished physical dimensions. Cross-stitch/color-by-number size by fabric
 * (Aida) count - stitches per inch. Diamond painting and fuse beads size by
 * the piece in millimetres (drill size, or bead size = peg spacing), since
 * pieces sit edge to edge rather than being counted against a fabric mesh.
 * Fused beads shrink a little as they melt together, so a fused piece can
 * come out slightly smaller.
 */
export function computeFinishedSize(
  type: PatternType,
  gridWidth: number,
  gridHeight: number,
  fabricCountOrDrillSizeMm: number,
): FinishedSize | null {
  if (fabricCountOrDrillSizeMm <= 0) return null;

  const inches =
    type === 'diamond' || type === 'fuse_bead'
      ? {
          width: (gridWidth * fabricCountOrDrillSizeMm) / MM_PER_INCH,
          height: (gridHeight * fabricCountOrDrillSizeMm) / MM_PER_INCH,
        }
      : {
          width: gridWidth / fabricCountOrDrillSizeMm,
          height: gridHeight / fabricCountOrDrillSizeMm,
        };

  return {
    inches,
    cm: { width: inches.width * 2.54, height: inches.height * 2.54 },
  };
}
