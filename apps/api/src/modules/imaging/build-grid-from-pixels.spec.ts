import type { Rgb } from '@stitchcraft/types';
import { decodeGrid } from '@stitchcraft/types';

import { buildGridFromPixels, effectiveDither } from './build-grid-from-pixels';

function solidBlock(color: Rgb, count: number): Rgb[] {
  return Array.from({ length: count }, () => ({ ...color }));
}

describe('buildGridFromPixels', () => {
  it('throws when the pixel count does not match width*height', () => {
    expect(() => buildGridFromPixels([{ r: 0, g: 0, b: 0 }], 2, 2, 1)).toThrow();
  });

  it('produces a palette no larger than the requested color count', () => {
    const pixels = [
      ...solidBlock({ r: 220, g: 20, b: 20 }, 2),
      ...solidBlock({ r: 20, g: 20, b: 220 }, 2),
    ];
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

  it('delivers the requested colour count on a many-coloured image', () => {
    // A smooth two-axis gradient: far more distinct colours than requested,
    // and dense enough that several k-means centres snap to one DMC thread.
    const width = 40;
    const height = 30;
    const pixels: Rgb[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        pixels.push({ r: Math.round((x / width) * 255), g: 90, b: Math.round((y / height) * 255) });
      }
    }
    const { palette, grid } = buildGridFromPixels(pixels, width, height, 20);
    expect(palette).toHaveLength(20);
    // ...and every one of them is actually used.
    const used = new Set(decodeGrid(grid, width).flatMap((row) => Array.from(row)));
    expect(used.size).toBe(20);
  });

  describe('colour blending (dither)', () => {
    // A horizontal grey ramp with only 3 colours allowed: plain mapping makes
    // flat bands, blending mixes neighbouring threads across each band edge.
    const width = 60;
    const height = 20;
    const ramp: Rgb[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = Math.round((x / (width - 1)) * 255);
        ramp.push({ r: v, g: v, b: v });
      }
    }
    const changesAlongRows = (grid: ReturnType<typeof buildGridFromPixels>['grid']) =>
      decodeGrid(grid, width).reduce(
        (sum, row) => sum + row.reduce((n, v, x) => n + (x > 0 && v !== row[x - 1] ? 1 : 0), 0),
        0,
      );

    it('mixes threads across band edges, more at full than at light', () => {
      const none = changesAlongRows(buildGridFromPixels(ramp, width, height, 3).grid);
      const light = changesAlongRows(
        buildGridFromPixels(ramp, width, height, 3, { dither: 'light' }).grid,
      );
      const full = changesAlongRows(
        buildGridFromPixels(ramp, width, height, 3, { dither: 'full' }).grid,
      );
      expect(light).toBeGreaterThan(none);
      expect(full).toBeGreaterThan(light);
    });

    it('uses the same threads with or without blending', () => {
      const codes = (dither?: 'none' | 'full') =>
        buildGridFromPixels(ramp, width, height, 3, { dither })
          .palette.map((e) => (e.color as { code: string }).code)
          .sort();
      expect(codes('full')).toEqual(codes('none'));
    });

    it('is never applied to paint by number', () => {
      expect(effectiveDither('color_by_number', 'full')).toBe('none');
      expect(effectiveDither('diamond', 'light')).toBe('light');
      expect(effectiveDither('cross_stitch', undefined)).toBe('none');
    });
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
    const pixels = [
      ...solidBlock({ r: 230, g: 10, b: 10 }, 4),
      ...solidBlock({ r: 10, g: 10, b: 230 }, 4),
    ];
    const { grid, palette } = buildGridFromPixels(pixels, 4, 2, 2);
    const decoded = decodeGrid(grid, 4);
    if (palette.length > 1) {
      expect(decoded[0][0]).not.toBe(decoded[1][0]);
    }
  });

  describe('cleanup', () => {
    const red = { r: 220, g: 20, b: 20 };
    const blue = { r: 20, g: 20, b: 220 };
    const green = { r: 20, g: 200, b: 40 };

    /** 10x10 red field with one blue stitch in the middle. */
    function fieldWithSpeck(): Rgb[] {
      const pixels = solidBlock(red, 100);
      pixels[55] = blue;
      return pixels;
    }

    it('is off by default and reports nothing', () => {
      const result = buildGridFromPixels(fieldWithSpeck(), 10, 10, 2);
      expect(result.cleanup).toBeUndefined();
      expect(result.palette).toHaveLength(2);
    });

    it('recolours lone stitches and drops colours nothing uses any more', () => {
      const result = buildGridFromPixels(fieldWithSpeck(), 10, 10, 2, { cleanup: true });
      expect(result.cleanup).toEqual({ strayStitchesRemoved: 1, colorsMerged: 0 });
      expect(result.palette).toHaveLength(1);
      expect(result.grid.every((row) => row.length === 1 && row[0][0] === 0)).toBe(true);
    });

    it('merges a colour used for only a few (clumped) stitches into its closest common colour', () => {
      // 20x20 = 400 cells, threshold max(4, 0.8) = 4: a 2x1 clump of blue is
      // not confetti (the two touch) but is too rare to keep its own thread.
      const pixels = [...solidBlock(red, 200), ...solidBlock(green, 200)];
      pixels[30] = blue;
      pixels[31] = blue;
      const result = buildGridFromPixels(pixels, 20, 20, 3, { cleanup: true });
      expect(result.cleanup).toEqual({ strayStitchesRemoved: 0, colorsMerged: 1 });
      expect(result.palette).toHaveLength(2);
      const decoded = decodeGrid(result.grid, 20);
      expect(decoded[1][10]).toBe(decoded[0][0]);
    });
  });

  it('for paint by number, merges areas too small to paint', () => {
    // 10x10: left half red with a 2-cell blue clump in it, right half blue.
    // The clump isn't confetti (its cells touch) and blue isn't rare.
    const red = { r: 220, g: 20, b: 20 };
    const blue = { r: 20, g: 20, b: 220 };
    const pixels = Array.from({ length: 100 }, (_, i) => (i % 10 < 5 ? red : blue));
    pixels[41] = blue;
    pixels[42] = blue;
    const plain = buildGridFromPixels(pixels, 10, 10, 2, { cleanup: true });
    expect(decodeGrid(plain.grid, 10)[4][1]).toBe(decodeGrid(plain.grid, 10)[0][9]);
    const pbn = buildGridFromPixels(pixels, 10, 10, 2, { cleanup: true, minRegionSize: 4 });
    expect(pbn.cleanup?.regionsMerged).toBe(1);
    const rows = decodeGrid(pbn.grid, 10);
    expect(rows[4][1]).toBe(rows[0][0]); // clump is red now
  });
});
