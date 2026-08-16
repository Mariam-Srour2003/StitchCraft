import { PrismaService } from '../../prisma/prisma.service';
import { PalettesService } from './palettes.service';

describe('PalettesService.findDmc', () => {
  const service = new PalettesService({} as PrismaService);

  it('defaults to page 1 with the default page size', () => {
    const result = service.findDmc({});
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(result.pageSize);
    expect(result.total).toBe(454);
  });

  it('paginates using page/pageSize', () => {
    const pageOne = service.findDmc({ page: 1, pageSize: 10 });
    const pageTwo = service.findDmc({ page: 2, pageSize: 10 });
    expect(pageOne.items).toHaveLength(10);
    expect(pageTwo.items).toHaveLength(10);
    expect(pageOne.items[0].code).not.toBe(pageTwo.items[0].code);
  });

  it('filters by name or code, case-insensitively', () => {
    const result = service.findDmc({ search: 'black' });
    expect(result.total).toBeGreaterThan(0);
    for (const color of result.items) {
      expect(color.name.toLowerCase()).toContain('black');
    }
  });

  it('finds an exact color by code search', () => {
    const result = service.findDmc({ search: '310' });
    expect(result.items.some((c) => c.code === '310')).toBe(true);
  });

  it('returns an empty page for a search with no matches', () => {
    const result = service.findDmc({ search: 'not-a-real-color-name' });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });
});
