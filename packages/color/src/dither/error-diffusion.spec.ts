import type { Rgb } from '@stitchcraft/types';

import { srgbToLab } from '../space/srgb-lab';
import { ditherToPalette } from './error-diffusion';

const BLACK = srgbToLab({ r: 0, g: 0, b: 0 });
const WHITE = srgbToLab({ r: 255, g: 255, b: 255 });

function flat(color: Rgb, width: number, height: number): Rgb[] {
  return Array.from({ length: width * height }, () => ({ ...color }));
}

function share(rows: Int16Array[], index: number): number {
  let hits = 0;
  let total = 0;
  for (const row of rows) for (const v of row) (total++, v === index && hits++);
  return hits / total;
}

describe('ditherToPalette', () => {
  // Mid-grey in Lab is about L=53, so black and white should mix roughly half and half.
  const grey = flat({ r: 128, g: 128, b: 128 }, 20, 20);

  it('with strength 0 maps every pixel to its nearest colour', () => {
    const rows = ditherToPalette(grey, 20, 20, [BLACK, WHITE], 0, srgbToLab);
    const first = rows[0][0];
    expect(rows.every((row) => row.every((v) => v === first))).toBe(true);
  });

  it('with full strength mixes two colours in proportion to the target', () => {
    const rows = ditherToPalette(grey, 20, 20, [BLACK, WHITE], 1, srgbToLab);
    expect(share(rows, 1)).toBeGreaterThan(0.4);
    expect(share(rows, 1)).toBeLessThan(0.65);
  });

  it('mixes less at half strength than at full strength', () => {
    const light = flat({ r: 200, g: 200, b: 200 }, 30, 30);
    const half = share(ditherToPalette(light, 30, 30, [BLACK, WHITE], 0.5, srgbToLab), 0);
    const full = share(ditherToPalette(light, 30, 30, [BLACK, WHITE], 1, srgbToLab), 0);
    expect(half).toBeLessThan(full);
  });

  it('leaves exact palette colours alone', () => {
    const rows = ditherToPalette(
      flat({ r: 255, g: 255, b: 255 }, 8, 8),
      8,
      8,
      [BLACK, WHITE],
      1,
      srgbToLab,
    );
    expect(share(rows, 1)).toBe(1);
  });

  it('is deterministic and keeps the grid shape', () => {
    const a = ditherToPalette(grey, 20, 20, [BLACK, WHITE], 1, srgbToLab);
    const b = ditherToPalette(grey, 20, 20, [BLACK, WHITE], 1, srgbToLab);
    expect(a).toEqual(b);
    expect(a).toHaveLength(20);
    expect(a[0]).toHaveLength(20);
  });

  it('rejects a pixel count that does not match the size', () => {
    expect(() => ditherToPalette(grey, 3, 3, [BLACK, WHITE], 1, srgbToLab)).toThrow();
  });
});
