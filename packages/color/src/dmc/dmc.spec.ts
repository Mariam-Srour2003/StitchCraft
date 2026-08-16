import { DMC_COLORS, findDmcByCode } from './index';

describe('DMC dataset', () => {
  it('loads 454 colors', () => {
    expect(DMC_COLORS.length).toBe(454);
  });

  it('has no duplicate codes', () => {
    const codes = new Set(DMC_COLORS.map((c) => c.code));
    expect(codes.size).toBe(DMC_COLORS.length);
  });

  it('every entry has a valid 6-digit hex and precomputed lab', () => {
    for (const color of DMC_COLORS) {
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(typeof color.lab.l).toBe('number');
      expect(color.lab.l).toBeGreaterThanOrEqual(0);
      expect(color.lab.l).toBeLessThanOrEqual(100);
    }
  });

  it('finds black (310) by code', () => {
    expect(findDmcByCode('310')).toMatchObject({ name: 'Black', hex: '#000000' });
  });

  it('returns undefined for an unknown code', () => {
    expect(findDmcByCode('not-a-real-code')).toBeUndefined();
  });
});
