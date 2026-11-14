import type { Lab, Rgb } from '@stitchcraft/types';

import { srgbToLab } from '../space/srgb-lab';
import { fillPalette, labHistogram } from './fill-palette';

interface Swatch {
  name: string;
  lab: Lab;
}
const swatch = (name: string, rgb: Rgb): Swatch => ({ name, lab: srgbToLab(rgb) });

const RED = swatch('red', { r: 220, g: 20, b: 20 });
const DARK_RED = swatch('dark red', { r: 120, g: 10, b: 10 });
const GREEN = swatch('green', { r: 20, g: 180, b: 40 });
const BLUE = swatch('blue', { r: 20, g: 30, b: 210 });
const CATALOGUE = [RED, DARK_RED, GREEN, BLUE];

describe('labHistogram', () => {
  it('groups near-identical pixels and keeps their total weight', () => {
    const pixels: Rgb[] = [
      { r: 200, g: 10, b: 10 },
      { r: 201, g: 11, b: 12 }, // same 5-bit bin as the first
      { r: 10, g: 10, b: 200 },
    ];
    const hist = labHistogram(pixels, srgbToLab);
    expect(hist).toHaveLength(2);
    expect(hist.reduce((s, h) => s + h.weight, 0)).toBe(3);
    expect(hist[0].weight).toBe(2);
  });

  it('is empty for no pixels', () => {
    expect(labHistogram([], srgbToLab)).toEqual([]);
  });
});

describe('fillPalette', () => {
  const image = labHistogram(
    [
      ...Array.from({ length: 50 }, () => ({ r: 220, g: 20, b: 20 })),
      ...Array.from({ length: 30 }, () => ({ r: 20, g: 180, b: 40 })),
      ...Array.from({ length: 10 }, () => ({ r: 20, g: 30, b: 210 })),
    ],
    srgbToLab,
  );

  it('adds the colour that removes the most error first', () => {
    const result = fillPalette(image, [RED], CATALOGUE, 2);
    expect(result.map((s) => s.name)).toEqual(['red', 'green']);
  });

  it('fills up to the target when every addition helps', () => {
    const result = fillPalette(image, [RED], CATALOGUE, 3);
    expect(result.map((s) => s.name)).toEqual(['red', 'green', 'blue']);
  });

  it('stops early when no candidate improves the image', () => {
    // Every image colour is already matched exactly; dark red helps nothing.
    const result = fillPalette(image, [RED, GREEN, BLUE], CATALOGUE, 4);
    expect(result).toHaveLength(3);
  });

  it('skips additions that barely change the picture', () => {
    // Blue covers 10 of 90 pixels; demanding an average gain of 50 ΔE per
    // pixel across the whole image is more than it can deliver.
    expect(fillPalette(image, [RED, GREEN], CATALOGUE, 3, 50)).toEqual([RED, GREEN]);
    expect(fillPalette(image, [RED, GREEN], CATALOGUE, 3, 0.01).map((s) => s.name)).toContain(
      'blue',
    );
  });

  it('never adds a colour twice or changes the chosen ones', () => {
    const result = fillPalette(image, [GREEN, RED], CATALOGUE, 4);
    expect(result.slice(0, 2)).toEqual([GREEN, RED]);
    expect(new Set(result).size).toBe(result.length);
  });

  it('returns the chosen colours when already at the target', () => {
    expect(fillPalette(image, [RED, GREEN], CATALOGUE, 2)).toEqual([RED, GREEN]);
  });

  it('starts from nothing when no colour is chosen yet', () => {
    expect(fillPalette(image, [], CATALOGUE, 1).map((s) => s.name)).toEqual(['red']);
  });
});
