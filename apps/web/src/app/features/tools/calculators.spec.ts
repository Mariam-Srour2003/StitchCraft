import {
  drillEstimate,
  fabricSize,
  stitchesForSize,
  threadEstimate,
  timeEstimate,
} from './calculators';

describe('calculators', () => {
  it('sizes a design and the fabric to cut', () => {
    const size = fabricSize(84, 70, 14, 3);
    expect(size.designWidthIn).toBe(6);
    expect(size.designHeightIn).toBe(5);
    expect(size.cutWidthIn).toBe(12);
    expect(size.cutHeightCm).toBe(27.9);
    expect(size.designWidthCm).toBe(15.2);
  });

  it('halves the effective count when stitching over two', () => {
    expect(fabricSize(84, 84, 28, 0, true).designWidthIn).toBe(6);
  });

  it('works out stitches that fit a size', () => {
    expect(stitchesForSize(8, 14)).toBe(112);
    expect(stitchesForSize(-1, 14)).toBe(0);
  });

  it('estimates thread and drills', () => {
    expect(threadEstimate(0, 14).skeins).toBe(0);
    expect(threadEstimate(5000, 14, 2).skeins).toBe(3);
    const drills = drillEstimate(100, 50, 2.5);
    expect(drills).toEqual({ drills: 5000, bags: 28, widthCm: 25, heightCm: 12.5 });
  });

  it('estimates time in hours and days', () => {
    expect(timeEstimate(800, 80, 2)).toEqual({ hours: 10, days: 5 });
    expect(timeEstimate(0, 80, 2)).toEqual({ hours: 0, days: 0 });
  });
});
