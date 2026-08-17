import { decodeGrid, Rgb } from '@stitchcraft/types';
import { buildGridFromPixels } from './build-grid-from-pixels';

function solidBlock(color: Rgb, count: number): Rgb[] {
  return Array.from({ length: count }, () => ({ ...color }));
}

describe('buildGridFromPixels', () => {
  it('throws when the pixel count does not match width*height', () => {
    expect(() => buildGridFromPixels([{ r: 0, g: 0, b: 0 }], 2, 2, 1)).toThrow();
  });

  it('produces a palette no larger than the requested color count', () => {
    const pixels = [...solidBlock({ r: 220, g: 20, b: 20 }, 2), ...solidBlock({ r: 20, g: 20, b: 220 }, 2)];
    const { palette } = buildGridFromPixels(pixels, 2, 2, 2);
    expect(palette.length).toBeLessThanOrEqual(2);
    expect(palette.length).toBeGreaterThan(0);
  });

  it('never emits a grid index that is out of range for the palette', () => {
    const pixels = [
      ...solidBlock({ r: 220, g: 20, b: 20 }, 4),
      ...solidBlock({ r: 20, g: 220, b: 20 }, 4),
      ...solidBlock({ r: 20, g: 20, b: 220 }, 4),
    ];
    const { palette, grid } = buildGridFromPixels(pixels, 4, 3, 3);
    const decoded = decodeGrid(grid, 4);
    for (const row of decoded) {
      for (const value of row) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(palette.length);
      }
    }
  });

  it('never returns two palette entries pointing at the same DMC code (dedup)', () => {
    // Two near-identical dark shades are likely to snap to the same nearest
    // DMC thread; the palette must still list each real thread only once.
    const pixels = [...solidBlock({ r: 1, g: 1, b: 1 }, 4), ...solidBlock({ r: 3, g: 3, b: 3 }, 4)];
    const { palette } = buildGridFromPixels(pixels, 4, 2, 2);
    const codes = palette.map((entry) => (entry.color as { code: string }).code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('assigns every palette entry a distinct symbol', () => {
    const pixels = [
      ...solidBlock({ r: 220, g: 20, b: 20 }, 4),
      ...solidBlock({ r: 20, g: 220, b: 20 }, 4),
      ...solidBlock({ r: 20, g: 20, b: 220 }, 4),
      ...solidBlock({ r: 220, g: 220, b: 20 }, 4),
    ];
    const { palette } = buildGridFromPixels(pixels, 4, 4, 4);
    const symbols = palette.map((entry) => entry.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('preserves grid dimensions', () => {
    const pixels = solidBlock({ r: 100, g: 100, b: 100 }, 20);
    const { grid } = buildGridFromPixels(pixels, 5, 4, 3);
    const decoded = decodeGrid(grid, 5);
    expect(decoded).toHaveLength(4);
    for (const row of decoded) expect(row).toHaveLength(5);
  });

  it('assigns visually distinct regions to different palette entries', () => {
    const pixels = [...solidBlock({ r: 230, g: 10, b: 10 }, 4), ...solidBlock({ r: 10, g: 10, b: 230 }, 4)];
    const { grid, palette } = buildGridFromPixels(pixels, 4, 2, 2);
    const decoded = decodeGrid(grid, 4);
    if (palette.length > 1) {
      expect(decoded[0][0]).not.toBe(decoded[1][0]);
    }
  });
});
