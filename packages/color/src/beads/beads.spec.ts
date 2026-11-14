import { catalogueLabel } from '@stitchcraft/types';

import { srgbToLab } from '../space/srgb-lab';
import { BEAD_CATALOGUES, beadColorsForConversion, findBeadCatalogue } from './index';

describe('bead catalogues', () => {
  it('has the seven bead lines with their bead sizes', () => {
    expect(BEAD_CATALOGUES.map((c) => [c.id, c.beadSizeMm])).toEqual([
      ['perler', 5],
      ['perler-mini', 2.6],
      ['hama-midi', 5],
      ['hama-mini', 2.5],
      ['artkal-s', 5],
      ['artkal-c', 2.6],
      ['nabbi', 5],
    ]);
  });

  it('matches the colour counts of the source lists', () => {
    const counts = Object.fromEntries(BEAD_CATALOGUES.map((c) => [c.id, c.colors.length]));
    expect(counts).toEqual({
      perler: 103,
      'perler-mini': 41,
      'hama-midi': 92,
      'hama-mini': 78,
      'artkal-s': 199,
      'artkal-c': 174,
      nabbi: 30,
    });
  });

  it.each(BEAD_CATALOGUES.map((c) => [c.id, c] as const))(
    '%s: unique codes, valid hex, Lab matching its RGB, brand on every colour',
    (_id, catalogue) => {
      const codes = new Set(catalogue.colors.map((c) => c.code));
      expect(codes.size).toBe(catalogue.colors.length);
      for (const color of catalogue.colors) {
        expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
        expect(color.brand).toBe(catalogue.brand);
        const lab = srgbToLab(color.rgb);
        expect(color.lab.l).toBeCloseTo(lab.l, 3);
        expect(color.lab.a).toBeCloseTo(lab.a, 3);
        expect(color.lab.b).toBeCloseTo(lab.b, 3);
      }
    },
  );

  it('tags special finishes from the name and leaves plain colours solid', () => {
    const hama = findBeadCatalogue('hama-midi');
    const finish = (name: string) => hama?.colors.find((c) => c.name === name)?.finish;
    expect(finish('White')).toBe('solid');
    expect(finish('Clear')).toBe('translucent');
    expect(finish('Neon Yellow')).toBe('neon');
    const artkal = findBeadCatalogue('artkal-s');
    expect(artkal?.colors.find((c) => c.name === 'Glow Pink')?.finish).toBe('glow');
    // Names that only sound special stay solid.
    const perler = findBeadCatalogue('perler');
    expect(perler?.colors.find((c) => c.name === 'Cotton Candy')?.finish).toBe('solid');
  });

  it('converts photos with opaque beads only, unless asked otherwise', () => {
    const hama = findBeadCatalogue('hama-midi');
    if (!hama) throw new Error('hama-midi missing');
    expect(beadColorsForConversion(hama)).toHaveLength(65);
    expect(beadColorsForConversion(hama).every((c) => c.finish === 'solid')).toBe(true);
    expect(beadColorsForConversion(hama, true)).toHaveLength(92);
  });

  it('returns undefined for an unknown catalogue', () => {
    expect(findBeadCatalogue('lego')).toBeUndefined();
  });

  it('labels bead colours with their brand, DMC threads as DMC', () => {
    const white = findBeadCatalogue('hama-midi')?.colors.find((c) => c.code === 'H01');
    expect(white && catalogueLabel(white)).toBe('Hama H01 — White');
    expect(
      catalogueLabel({
        code: '310',
        name: 'Black',
        hex: '#000000',
        rgb: { r: 0, g: 0, b: 0 },
        lab: { l: 0, a: 0, b: 0 },
      }),
    ).toBe('DMC 310 — Black');
    expect(catalogueLabel({ hex: '#123456', rgb: { r: 18, g: 52, b: 86 } })).toBe('#123456');
  });
});
