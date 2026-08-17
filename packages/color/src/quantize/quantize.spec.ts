import type { Rgb } from '@stitchcraft/types';
import { kMeansQuantize } from './k-means';
import { medianCutQuantize } from './median-cut';

const RED: Rgb = { r: 220, g: 20, b: 20 };
const GREEN: Rgb = { r: 20, g: 200, b: 40 };
const BLUE: Rgb = { r: 20, g: 30, b: 210 };

function repeat(color: Rgb, times: number): Rgb[] {
  return Array.from({ length: times }, () => ({ ...color }));
}

describe.each([
  ['medianCutQuantize', medianCutQuantize],
  ['kMeansQuantize', kMeansQuantize],
])('%s', (_name, quantize) => {
  it('returns an empty array for no input pixels', () => {
    expect(quantize([], 4)).toEqual([]);
  });

  it('never returns more colors than requested', () => {
    const pixels = [...repeat(RED, 50), ...repeat(GREEN, 50), ...repeat(BLUE, 50)];
    const result = quantize(pixels, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('does not request more clusters than distinct input pixels', () => {
    const pixels = repeat(RED, 3);
    const result = quantize(pixels, 10);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('is deterministic across repeated runs on the same input', () => {
    const pixels = [...repeat(RED, 30), ...repeat(GREEN, 30), ...repeat(BLUE, 30)];
    const first = quantize(pixels, 3);
    const second = quantize(pixels, 3);
    expect(second).toEqual(first);
  });

  it('separates three well-clustered color groups into three distinct outputs', () => {
    const pixels = [...repeat(RED, 40), ...repeat(GREEN, 40), ...repeat(BLUE, 40)];
    const result = quantize(pixels, 3);
    expect(result).toHaveLength(3);

    // each output color should land reasonably close to one of the three input clusters
    const closeToRed = result.some((c) => Math.abs(c.r - RED.r) < 20 && Math.abs(c.g - RED.g) < 20);
    const closeToGreen = result.some(
      (c) => Math.abs(c.r - GREEN.r) < 20 && Math.abs(c.g - GREEN.g) < 20,
    );
    const closeToBlue = result.some(
      (c) => Math.abs(c.b - BLUE.b) < 20 && Math.abs(c.r - BLUE.r) < 20,
    );
    expect(closeToRed).toBe(true);
    expect(closeToGreen).toBe(true);
    expect(closeToBlue).toBe(true);
  });

  it('collapses a single uniform image to one color', () => {
    const pixels = repeat(RED, 25);
    const result = quantize(pixels, 5);
    expect(result).toHaveLength(1);
    expect(result[0].r).toBeCloseTo(RED.r, 0);
    expect(result[0].g).toBeCloseTo(RED.g, 0);
    expect(result[0].b).toBeCloseTo(RED.b, 0);
  });
});
