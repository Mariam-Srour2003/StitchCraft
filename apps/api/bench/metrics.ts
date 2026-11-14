import { ciede2000, srgbToLab } from '@stitchcraft/color';
import type { Lab, Rgb } from '@stitchcraft/types';
import { decodeGrid, EMPTY_CELL, type EncodedRow, type PaletteEntry } from '@stitchcraft/types';

export interface PatternMetrics {
  /** Colours actually used in the grid. */
  colours: number;
  /** Mean CIEDE2000 between each source pixel and the thread it became. */
  meanDE: number;
  /**
   * Mean CIEDE2000 after a small blur of both images: roughly how far off the
   * piece looks from a step back, where neighbouring stitches blend.
   */
  viewDE: number;
  /** Share of stitches with no same-colour neighbour among their 8 (the cleanup's definition of confetti). */
  confettiPct: number;
  /** Unbroken same-colour runs along rows: a rough proxy for thread changes. */
  runs: number;
}

/**
 * Scores a converted pattern against the pixels it was made from. Empty
 * cells are skipped in the colour errors (they are fabric, not a thread).
 */
export function measurePattern(
  pixels: readonly Rgb[],
  width: number,
  height: number,
  palette: readonly PaletteEntry[],
  grid: readonly EncodedRow[],
): PatternMetrics {
  const rows = decodeGrid(grid as EncodedRow[], width);
  const paletteLabs = palette.map((entry) => srgbToLab(entry.color.rgb));
  const sourceLabs = pixels.map(srgbToLab);
  const outLabs: (Lab | null)[] = new Array(width * height);
  const used = new Set<number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = rows[y][x];
      outLabs[y * width + x] = v === EMPTY_CELL ? null : paletteLabs[v];
      if (v !== EMPTY_CELL) used.add(v);
    }
  }

  let de = 0;
  let counted = 0;
  for (let i = 0; i < outLabs.length; i++) {
    const out = outLabs[i];
    if (!out) continue;
    de += ciede2000(sourceLabs[i], out);
    counted++;
  }

  const blurredSource = blur(sourceLabs, width, height);
  const blurredOut = blur(
    outLabs.map((lab, i) => lab ?? sourceLabs[i]),
    width,
    height,
  );
  let viewDE = 0;
  for (let i = 0; i < outLabs.length; i++) {
    if (!outLabs[i]) continue;
    viewDE += ciede2000(blurredSource[i], blurredOut[i]);
  }

  let confetti = 0;
  let stitches = 0;
  let runs = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = rows[y][x];
      if (v === EMPTY_CELL) continue;
      stitches++;
      if (x === 0 || rows[y][x - 1] !== v) runs++;
      let alone = true;
      for (let dy = -1; dy <= 1 && alone; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (rows[y + dy]?.[x + dx] === v) {
            alone = false;
            break;
          }
        }
      }
      if (alone) confetti++;
    }
  }

  return {
    colours: used.size,
    meanDE: counted ? de / counted : 0,
    viewDE: counted ? viewDE / counted : 0,
    confettiPct: stitches ? (100 * confetti) / stitches : 0,
    runs,
  };
}

/** Separable 5-tap binomial blur in Lab. */
function blur(labs: readonly Lab[], width: number, height: number): Lab[] {
  const kernel = [1, 4, 6, 4, 1];
  const pass = (src: readonly Lab[], horizontal: boolean): Lab[] =>
    src.map((_, i) => {
      const x = i % width;
      const y = (i - x) / width;
      let l = 0;
      let a = 0;
      let b = 0;
      let total = 0;
      for (let t = -2; t <= 2; t++) {
        const xx = horizontal ? x + t : x;
        const yy = horizontal ? y : y + t;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
        const s = src[yy * width + xx];
        const w = kernel[t + 2];
        l += s.l * w;
        a += s.a * w;
        b += s.b * w;
        total += w;
      }
      return { l: l / total, a: a / total, b: b / total };
    });
  return pass(pass(labs, true), false);
}
