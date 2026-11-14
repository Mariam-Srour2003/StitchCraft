import type { Lab } from '@stitchcraft/types';

import { ciede2000 } from '../difference/ciede2000';

/**
 * Plans folding colours that are barely used into the closest colour that
 * isn't. A thread bought for six stitches is money and a thread change for
 * almost no visible difference - photo conversions produce several of them.
 *
 * Returns `remap[i]` = the palette index colour `i`'s cells should become
 * (itself when it stays). Colours with zero cells map to themselves - removing
 * unused colours is a separate, explicit step. When every used colour is rare
 * nothing is merged, since there would be nothing sensible to merge into.
 */
export function planRareColorMerge(
  labs: readonly Lab[],
  counts: readonly number[],
  minCells: number,
): number[] {
  const remap = labs.map((_, index) => index);
  const keepers = labs.map((_, index) => index).filter((index) => (counts[index] ?? 0) >= minCells);
  if (keepers.length === 0) return remap;

  for (let index = 0; index < labs.length; index++) {
    const count = counts[index] ?? 0;
    if (count === 0 || count >= minCells) continue;
    let best = keepers[0];
    let bestDistance = Infinity;
    for (const keeper of keepers) {
      const distance = ciede2000(labs[index], labs[keeper]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = keeper;
      }
    }
    remap[index] = best;
  }
  return remap;
}
