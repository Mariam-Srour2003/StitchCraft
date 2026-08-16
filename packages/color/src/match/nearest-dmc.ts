import { DmcColor, Lab, Rgb } from '@stitchcraft/types';
import { ciede2000 } from '../difference/ciede2000';
import { srgbToLab } from '../space/srgb-lab';

export interface NearestMatch {
  color: DmcColor;
  distance: number;
}

/**
 * Finds the DMC color perceptually closest (lowest CIEDE2000 distance) to the
 * given color. `palette` defaults to the full seeded DMC set but accepts a
 * restricted list so callers can implement "lock this color" by excluding
 * already-assigned codes, or restrict to a curated subset.
 */
export function nearestDmc(target: Rgb | Lab, palette: readonly DmcColor[]): NearestMatch {
  if (palette.length === 0) {
    throw new Error('nearestDmc: palette must not be empty');
  }
  const targetLab = isLab(target) ? target : srgbToLab(target);

  let best: NearestMatch | undefined;
  for (const color of palette) {
    const distance = ciede2000(targetLab, color.lab);
    if (!best || distance < best.distance) {
      best = { color, distance };
    }
  }
  return best as NearestMatch;
}

/** Same as {@link nearestDmc} but returns the `count` closest matches, nearest first. */
export function nearestDmcMany(
  target: Rgb | Lab,
  palette: readonly DmcColor[],
  count: number,
): NearestMatch[] {
  const targetLab = isLab(target) ? target : srgbToLab(target);
  return palette
    .map((color) => ({ color, distance: ciede2000(targetLab, color.lab) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

function isLab(value: Rgb | Lab): value is Lab {
  return 'l' in value;
}
