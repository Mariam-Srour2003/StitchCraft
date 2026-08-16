import { PatternType } from '@stitchcraft/types';

export interface FinishedSize {
  inches: { width: number; height: number };
  cm: { width: number; height: number };
}

const MM_PER_INCH = 25.4;

/**
 * Finished physical dimensions. Cross-stitch/color-by-number size by fabric
 * (Aida) count - stitches per inch. Diamond painting sizes by drill size in
 * millimetres, since drills are laid out edge-to-edge (typically 2.5-2.8mm
 * square, per the spec) rather than counted against a fabric mesh.
 */
export function computeFinishedSize(
  type: PatternType,
  gridWidth: number,
  gridHeight: number,
  fabricCountOrDrillSizeMm: number,
): FinishedSize | null {
  if (fabricCountOrDrillSizeMm <= 0) return null;

  const inches =
    type === 'diamond'
      ? {
          width: (gridWidth * fabricCountOrDrillSizeMm) / MM_PER_INCH,
          height: (gridHeight * fabricCountOrDrillSizeMm) / MM_PER_INCH,
        }
      : { width: gridWidth / fabricCountOrDrillSizeMm, height: gridHeight / fabricCountOrDrillSizeMm };

  return {
    inches,
    cm: { width: inches.width * 2.54, height: inches.height * 2.54 },
  };
}
