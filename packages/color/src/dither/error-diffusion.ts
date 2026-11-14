import type { Lab, Rgb } from '@stitchcraft/types';

import { createNearestLabMatcher } from '../match/nearest-color-index';

/**
 * Maps pixels onto a palette with Floyd-Steinberg error diffusion: whatever
 * colour a stitch misses by is passed on to the stitches not yet placed
 * (7/16 right, 3/16 below-left, 5/16 below, 1/16 below-right), so from a
 * step back the mix of threads averages out to the photo's real colour.
 * Gradients stop banding, at the price of more scattered stitches.
 *
 * Works in Lab (the space colour distances are measured in) and runs each
 * row in alternating directions, which avoids the diagonal "worms" a
 * left-to-right-only pass leaves. `strength` scales the error passed on:
 * 1 is classic full diffusion, 0.5 a lighter blend with far fewer lone
 * stitches, 0 is plain nearest colour. Deterministic.
 *
 * Returns one Int16Array of palette indexes per row.
 */
export function ditherToPalette(
  pixels: readonly Rgb[],
  width: number,
  height: number,
  paletteLabs: readonly Lab[],
  strength: number,
  toLab: (rgb: Rgb) => Lab,
): Int16Array[] {
  if (pixels.length !== width * height) {
    throw new Error(`ditherToPalette: expected ${width * height} pixels, got ${pixels.length}`);
  }
  const nearest = createNearestLabMatcher(paletteLabs);
  const k = Math.max(0, Math.min(1, strength));

  // Working copy of the image in Lab, which absorbs the diffused error.
  const L = new Float64Array(width * height);
  const A = new Float64Array(width * height);
  const B = new Float64Array(width * height);
  const labCache = new Map<number, Lab>();
  pixels.forEach((p, i) => {
    const key = (p.r << 16) | (p.g << 8) | p.b;
    let lab = labCache.get(key);
    if (!lab) {
      lab = toLab(p);
      labCache.set(key, lab);
    }
    L[i] = lab.l;
    A[i] = lab.a;
    B[i] = lab.b;
  });

  const rows: Int16Array[] = [];
  for (let y = 0; y < height; y++) {
    const row = new Int16Array(width);
    const leftToRight = y % 2 === 0;
    const step = leftToRight ? 1 : -1;
    for (let n = 0; n < width; n++) {
      const x = leftToRight ? n : width - 1 - n;
      const i = y * width + x;
      // Keep accumulated error inside real colours, or a long run of misses
      // can push a pixel somewhere no thread is near and spread artefacts.
      const lab = { l: clamp(L[i], 0, 100), a: clamp(A[i], -128, 127), b: clamp(B[i], -128, 127) };
      const index = nearest(lab);
      row[x] = index;
      if (k === 0) continue;

      const chosen = paletteLabs[index];
      const el = (lab.l - chosen.l) * k;
      const ea = (lab.a - chosen.a) * k;
      const eb = (lab.b - chosen.b) * k;
      const spread = (xx: number, yy: number, share: number) => {
        if (xx < 0 || xx >= width || yy >= height) return;
        const j = yy * width + xx;
        L[j] += el * share;
        A[j] += ea * share;
        B[j] += eb * share;
      };
      spread(x + step, y, 7 / 16);
      spread(x - step, y + 1, 3 / 16);
      spread(x, y + 1, 5 / 16);
      spread(x + step, y + 1, 1 / 16);
    }
    rows.push(row);
  }
  return rows;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
