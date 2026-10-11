import {
  defaultStrandsForCount,
  drillBagsNeeded,
  estimateMaterial,
  skeinsNeeded,
  stitchesPerSkein,
} from './materials';

describe('materials', () => {
  it('picks the conventional strand count for the fabric', () => {
    expect(defaultStrandsForCount(11)).toBe(3);
    expect(defaultStrandsForCount(14)).toBe(2);
    expect(defaultStrandsForCount(18)).toBe(2);
    expect(defaultStrandsForCount(22)).toBe(1);
  });

  it('lands near the 1800-2000 stitches/skein rule of thumb at 14-count, 2 strands', () => {
    const n = stitchesPerSkein(14, 2);
    expect(n).toBeGreaterThan(1800);
    expect(n).toBeLessThan(2000);
  });

  it('covers more stitches on finer fabric with the same strands', () => {
    expect(stitchesPerSkein(18, 2)).toBeGreaterThan(stitchesPerSkein(14, 2));
  });

  it('rounds skeins up and needs none for zero stitches', () => {
    expect(skeinsNeeded(0, 14)).toBe(0);
    expect(skeinsNeeded(1, 14)).toBe(1);
    expect(skeinsNeeded(stitchesPerSkein(14) + 1, 14)).toBe(2);
  });

  it('adds 10% spare drills and rounds to 200-drill bags', () => {
    expect(drillBagsNeeded(0)).toBe(0);
    expect(drillBagsNeeded(181)).toBe(1); // 199.1 -> 1 bag
    expect(drillBagsNeeded(182)).toBe(2); // 200.2 -> 2 bags
  });

  it('estimates per pattern type', () => {
    expect(estimateMaterial('diamond', 500)).toEqual({ quantity: 3, unit: 'bag' });
    expect(estimateMaterial('cross_stitch', 100, { fabricCount: 14 })).toEqual({
      quantity: 1,
      unit: 'skein',
    });
    expect(estimateMaterial('color_by_number', 100)).toBeNull();
  });
});
