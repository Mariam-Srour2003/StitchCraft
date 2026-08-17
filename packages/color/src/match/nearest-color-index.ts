import type { Lab } from '@stitchcraft/types';
import { ciede2000 } from '../difference/ciede2000';

/**
 * Finds the index of the closest color (by CIEDE2000) in a small palette of
 * precomputed Lab values. Used to assign each source-image pixel to one of
 * the N representative colors a quantizer already picked, which is a
 * separate step from quantization itself (the quantizer chooses good
 * centroids; this maps every pixel back onto them). Takes precomputed Lab
 * arrays rather than Rgb so callers processing many pixels against the same
 * small palette only convert the palette once.
 */
export function nearestColorIndex(targetLab: Lab, paletteLabs: readonly Lab[]): number {
  if (paletteLabs.length === 0) {
    throw new Error('nearestColorIndex: paletteLabs must not be empty');
  }

  let bestIndex = 0;
  let bestDistance = Infinity;
  paletteLabs.forEach((lab, index) => {
    const distance = ciede2000(targetLab, lab);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}
