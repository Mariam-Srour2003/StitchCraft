import { isDmcColor } from '@stitchcraft/types';
import { TEMPLATES, TEMPLATE_CATEGORIES, findTemplate } from './template-library';

describe('template library', () => {
  it('has unique ids and known categories', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) expect(TEMPLATE_CATEGORIES).toContain(t.category);
  });

  describe.each(TEMPLATES.map((t) => [t.id, t] as const))('%s', (_id, template) => {
    const design = template.build();

    it('builds a grid of the stated size within editor limits', () => {
      expect(design.width).toBeGreaterThan(0);
      expect(design.height).toBeGreaterThan(0);
      expect(design.width).toBeLessThanOrEqual(500);
      expect(design.height).toBeLessThanOrEqual(500);
      expect(design.rows).toHaveLength(design.height);
      for (const row of design.rows) expect(row).toHaveLength(design.width);
    });

    it('uses only real DMC threads, every one of them, with unique symbols', () => {
      expect(design.palette.length).toBeGreaterThan(0);
      for (const entry of design.palette) expect(isDmcColor(entry.color)).toBe(true);
      const used = new Set(design.rows.flat().filter((v) => v >= 0));
      expect(used.size).toBe(design.palette.length);
      expect(new Set(design.palette.map((e) => e.symbol)).size).toBe(design.palette.length);
    });

    it('has cell values that index the palette', () => {
      for (const v of design.rows.flat()) {
        expect(v === -1 || (v >= 0 && v < design.palette.length)).toBe(true);
      }
    });

    it('is deterministic', () => {
      expect(template.build()).toEqual(design);
    });
  });

  it('covers every cell in full-coverage crafts (diamond, paint by number)', () => {
    for (const t of TEMPLATES.filter((t) => t.type !== 'cross_stitch')) {
      expect(t.build().rows.flat()).not.toContain(-1);
    }
  });

  it('finds templates by id', () => {
    expect(findTemplate('heart')?.name).toBe('Little heart');
    expect(findTemplate('nope')).toBeUndefined();
  });
});
