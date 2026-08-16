import { DMC_COLORS, findDmcByCode } from '../dmc';
import { nearestDmc, nearestDmcMany } from './nearest-dmc';

describe('nearestDmc', () => {
  it('matches a color to itself exactly (distance ~0)', () => {
    const black = findDmcByCode('310')!;
    const match = nearestDmc(black.rgb, DMC_COLORS);
    expect(match.color.code).toBe('310');
    expect(match.distance).toBeCloseTo(0, 4);
  });

  it('matches near-black to black rather than to white or a bright color', () => {
    const match = nearestDmc({ r: 8, g: 6, b: 10 }, DMC_COLORS);
    expect(match.color.code).toBe('310');
  });

  it('throws on an empty palette', () => {
    expect(() => nearestDmc({ r: 0, g: 0, b: 0 }, [])).toThrow();
  });

  it('respects a restricted palette instead of always using the full DMC set', () => {
    const white = findDmcByCode('B5200')!;
    const offWhite = findDmcByCode('746')!;
    const restricted = [white, offWhite];
    const match = nearestDmc({ r: 250, g: 250, b: 245 }, restricted);
    expect(restricted.map((c) => c.code)).toContain(match.color.code);
  });
});

describe('nearestDmcMany', () => {
  it('returns results sorted nearest-first', () => {
    const results = nearestDmcMany({ r: 200, g: 30, b: 30 }, DMC_COLORS, 5);
    expect(results).toHaveLength(5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
    }
  });

  it('caps results at the requested count', () => {
    const results = nearestDmcMany({ r: 0, g: 0, b: 0 }, DMC_COLORS, 3);
    expect(results).toHaveLength(3);
  });
});
