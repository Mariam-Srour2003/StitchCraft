import { computeFinishedSize } from './size-math';

describe('computeFinishedSize', () => {
  it('divides grid size by fabric count for cross-stitch', () => {
    const size = computeFinishedSize('cross_stitch', 140, 100, 14);
    expect(size?.inches.width).toBeCloseTo(10, 5);
    expect(size?.inches.height).toBeCloseTo(7.142857, 5);
  });

  it('divides grid size by fabric count for color-by-number the same way', () => {
    const size = computeFinishedSize('color_by_number', 28, 14, 14);
    expect(size?.inches.width).toBeCloseTo(2, 5);
    expect(size?.inches.height).toBeCloseTo(1, 5);
  });

  it('multiplies grid size by drill size (mm) for diamond painting, then converts to inches', () => {
    const size = computeFinishedSize('diamond', 100, 50, 2.5);
    // 100 * 2.5mm = 250mm = 9.842... in
    expect(size?.inches.width).toBeCloseTo(250 / 25.4, 5);
    expect(size?.inches.height).toBeCloseTo(125 / 25.4, 5);
  });

  it('also reports centimetres', () => {
    const size = computeFinishedSize('cross_stitch', 14, 14, 14);
    expect(size?.cm.width).toBeCloseTo(2.54, 5);
  });

  it('returns null for a non-positive fabric count / drill size', () => {
    expect(computeFinishedSize('cross_stitch', 100, 100, 0)).toBeNull();
    expect(computeFinishedSize('diamond', 100, 100, -1)).toBeNull();
  });
});
