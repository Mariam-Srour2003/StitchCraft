import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PalettesService } from './palettes.service';

describe('PalettesService.remove', () => {
  let service: PalettesService;
  let prisma: { palette: { findUnique: jest.Mock; delete: jest.Mock } };

  beforeEach(() => {
    prisma = { palette: { findUnique: jest.fn(), delete: jest.fn() } };
    service = new PalettesService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException for a missing palette', async () => {
    prisma.palette.findUnique.mockResolvedValueOnce(null);
    await expect(service.remove('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException for a palette owned by another user', async () => {
    prisma.palette.findUnique.mockResolvedValueOnce({ id: 'p1', ownerId: 'someone-else' });
    await expect(service.remove('user-1', 'p1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.palette.delete).not.toHaveBeenCalled();
  });

  it('deletes a palette owned by the requesting user', async () => {
    prisma.palette.findUnique.mockResolvedValueOnce({ id: 'p1', ownerId: 'user-1' });
    await service.remove('user-1', 'p1');
    expect(prisma.palette.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
});

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
