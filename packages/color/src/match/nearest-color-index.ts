import type { Lab, Rgb } from '@stitchcraft/types';

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

/**
 * How many Euclidean-nearest candidates get the (slow) CIEDE2000 check.
 * Measured on four 200x200 photos against a 30-colour palette: 3 disagreed
 * with the exhaustive search on ~1% of pixels, 5 on ~0.1%, 8 on ~0.02%.
 */
const SHORTLIST = 5;

/**
 * Builds a fast `rgb -> nearest palette index` matcher for mapping many
 * pixels onto one small palette. CIEDE2000 costs ~5us a call, which made it
 * the slowest step of a conversion (pixels x colours calls). Plain Lab
 * distance agrees with CIEDE2000 about which colours are *close*, just not
 * always on their order, so each pixel only gets CIEDE2000 against its
 * SHORTLIST Euclidean-nearest colours; results are cached per RGB value since
 * photos repeat colours. About 8x faster than `nearestColorIndex` per pixel.
 *
 * Result is the same as `nearestColorIndex` unless CIEDE2000's winner is not
 * on the shortlist - about 0.1% of pixels on real photos, and those are
 * near-ties where either colour is a reasonable pick.
 */
export function createNearestColorMatcher(
  paletteLabs: readonly Lab[],
  toLab: (rgb: Rgb) => Lab,
): (rgb: Rgb) => number {
  if (paletteLabs.length === 0) {
    throw new Error('createNearestColorMatcher: paletteLabs must not be empty');
  }
  const cache = new Map<number, number>();
  const shortlist = Math.min(SHORTLIST, paletteLabs.length);
  const candidateIndex = new Int32Array(shortlist);
  const candidateDistance = new Float64Array(shortlist);

  return (rgb) => {
    const key = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const lab = toLab(rgb);
    candidateDistance.fill(Infinity);
    for (let index = 0; index < paletteLabs.length; index++) {
      const p = paletteLabs[index];
      const dl = lab.l - p.l;
      const da = lab.a - p.a;
      const db = lab.b - p.b;
      const distance = dl * dl + da * da + db * db;
      // insertion into the small sorted shortlist
      let slot = shortlist - 1;
      if (distance >= candidateDistance[slot]) continue;
      while (slot > 0 && candidateDistance[slot - 1] > distance) {
        candidateDistance[slot] = candidateDistance[slot - 1];
        candidateIndex[slot] = candidateIndex[slot - 1];
        slot--;
      }
      candidateDistance[slot] = distance;
      candidateIndex[slot] = index;
    }

    let best = candidateIndex[0];
    let bestDistance = Infinity;
    for (let i = 0; i < shortlist; i++) {
      const distance = ciede2000(lab, paletteLabs[candidateIndex[i]]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidateIndex[i];
      }
    }
    cache.set(key, best);
    return best;
  };
}
