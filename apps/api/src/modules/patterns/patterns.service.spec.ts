import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { decodeGrid } from '@stitchcraft/types';

import type { PrismaService } from '../../prisma/prisma.service';
import { PatternsService } from './patterns.service';

describe('PatternsService', () => {
  let service: PatternsService;
  let prisma: {
    project: { findUnique: jest.Mock };
    pattern: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      project: { findUnique: jest.fn() },
      pattern: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new PatternsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejects creating a pattern under a project owned by another user', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({ id: 'proj-1', userId: 'someone-else' });

      await expect(
        service.create('user-1', {
          projectId: 'proj-1',
          name: 'New',
          type: 'cross_stitch',
          width: 4,
          height: 4,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.pattern.create).not.toHaveBeenCalled();
    });

    it('rejects creating a pattern under a nonexistent project', async () => {
      prisma.project.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create('user-1', {
          projectId: 'missing',
          name: 'New',
          type: 'cross_stitch',
          width: 4,
          height: 4,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a fully blank grid of the requested dimensions', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({ id: 'proj-1', userId: 'user-1' });
      prisma.pattern.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({
          id: 'pattern-1',
          projectId: data.projectId,
          name: data.name,
          type: data.type,
          width: data.width,
          height: data.height,
          palette: data.palette,
          grid: data.grid,
          meta: data.meta,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        }),
      );

      const pattern = await service.create('user-1', {
        projectId: 'proj-1',
        name: 'New',
        type: 'cross_stitch',
        width: 5,
        height: 3,
      });

      expect(pattern.meta.createdFrom).toBe('blank');
      const decoded = decodeGrid(pattern.grid, pattern.width);
      expect(decoded).toHaveLength(3);
      for (const row of decoded) {
        expect(Array.from(row)).toEqual([-1, -1, -1, -1, -1]);
      }
    });
  });

  describe('findAllForProject', () => {
    it('rejects listing patterns for a project owned by another user', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({ id: 'proj-1', userId: 'someone-else' });
      await expect(service.findAllForProject('user-1', 'proj-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.pattern.findMany).not.toHaveBeenCalled();
    });

    it('rejects listing patterns for a nonexistent project', async () => {
      prisma.project.findUnique.mockResolvedValueOnce(null);
      await expect(service.findAllForProject('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the owned project patterns', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({ id: 'proj-1', userId: 'user-1' });
      prisma.pattern.findMany.mockResolvedValueOnce([
        {
          id: 'pattern-1',
          projectId: 'proj-1',
          name: 'A',
          type: 'cross_stitch',
          width: 4,
          height: 4,
          palette: [],
          grid: [],
          meta: { createdFrom: 'blank' },
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ]);

      const patterns = await service.findAllForProject('user-1', 'proj-1');
      expect(patterns).toHaveLength(1);
      expect(patterns[0].id).toBe('pattern-1');
    });
  });

  describe('ownership on existing patterns', () => {
    const existing = {
      id: 'pattern-1',
      project: { userId: 'user-1' },
      meta: { createdFrom: 'blank' },
    };

    it('throws NotFoundException for a missing pattern', async () => {
      prisma.pattern.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException for a pattern owned by another user', async () => {
      prisma.pattern.findUnique.mockResolvedValueOnce(existing);
      await expect(service.findOne('someone-else', 'pattern-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('duplicate', () => {
    const source = {
      id: 'pat-1',
      projectId: 'proj-1',
      name: 'Roses',
      type: 'cross_stitch',
      width: 2,
      height: 1,
      palette: [{ index: 0, symbol: 'A', color: { hex: '#000000', rgb: { r: 0, g: 0, b: 0 } } }],
      grid: [[[0, 2]]],
      meta: { createdFrom: 'blank', fabricCount: 16, progress: [[[1, 2]]] },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      project: { id: 'proj-1', userId: 'user-1' },
    };

    it('copies grid, palette and sizing into the same project without progress', async () => {
      prisma.pattern.findUnique.mockResolvedValueOnce(source);
      prisma.pattern.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ ...source, ...data, id: 'pat-2' }),
      );

      const copy = await service.duplicate('user-1', 'pat-1');

      const { data } = prisma.pattern.create.mock.calls[0][0];
      expect(data).toMatchObject({
        projectId: 'proj-1',
        name: 'Roses (copy)',
        width: 2,
        height: 1,
        grid: source.grid,
        palette: source.palette,
      });
      expect(data.meta).toEqual({ createdFrom: 'blank', fabricCount: 16 });
      expect(copy.id).toBe('pat-2');
    });

    it("refuses to duplicate someone else's pattern", async () => {
      prisma.pattern.findUnique.mockResolvedValueOnce({
        ...source,
        project: { id: 'proj-1', userId: 'someone-else' },
      });
      await expect(service.duplicate('user-1', 'pat-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.pattern.create).not.toHaveBeenCalled();
    });
  });

  describe('update grid integrity', () => {
    const existing = {
      id: 'pat-1',
      projectId: 'proj-1',
      name: 'P',
      type: 'cross_stitch',
      width: 2,
      height: 1,
      palette: [{ index: 0, symbol: 'A', color: { hex: '#000000', rgb: { r: 0, g: 0, b: 0 } } }],
      grid: [[[0, 2]]],
      meta: { createdFrom: 'blank' },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      project: { id: 'proj-1', userId: 'user-1' },
    };

    beforeEach(() => {
      prisma.pattern.findUnique.mockResolvedValue(existing);
      prisma.pattern.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...existing, ...data }),
      );
    });

    it('accepts a consistent grid', async () => {
      await service.update('user-1', 'pat-1', { width: 3, grid: [[[0, 3]]] });
      expect(prisma.pattern.update).toHaveBeenCalled();
    });

    it('rejects resizing without a grid that matches the new size', async () => {
      await expect(service.update('user-1', 'pat-1', { width: 3 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.pattern.update).not.toHaveBeenCalled();
    });

    it('rejects a grid that uses a color not in the palette', async () => {
      await expect(service.update('user-1', 'pat-1', { grid: [[[1, 2]]] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects removing a color the grid still uses', async () => {
      await expect(service.update('user-1', 'pat-1', { palette: [] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects stitching progress of the wrong shape', async () => {
      await expect(
        service.update('user-1', 'pat-1', { meta: { progress: [[[1, 5]]] } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows renames without re-validating anything', async () => {
      prisma.pattern.findUnique.mockResolvedValueOnce({ ...existing, grid: 'legacy junk' });
      await service.update('user-1', 'pat-1', { name: 'Renamed' });
      expect(prisma.pattern.update).toHaveBeenCalled();
    });
  });

  describe('backstitch validation', () => {
    const existing = {
      id: 'pat-1',
      projectId: 'proj-1',
      name: 'P',
      type: 'cross_stitch',
      width: 4,
      height: 4,
      palette: [{ index: 0, symbol: 'A', color: { hex: '#000000', rgb: { r: 0, g: 0, b: 0 } } }],
      grid: [[[null, 4]], [[null, 4]], [[null, 4]], [[null, 4]]],
      meta: {
        createdFrom: 'blank',
        backstitches: [{ x1: 0, y1: 0, x2: 4, y2: 4, paletteIndex: 0 }],
      },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      project: { id: 'proj-1', userId: 'user-1' },
    };

    beforeEach(() => {
      prisma.pattern.findUnique.mockResolvedValue(existing);
      prisma.pattern.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...existing, ...data }),
      );
    });

    it('accepts valid lines', async () => {
      await service.update('user-1', 'pat-1', {
        meta: { backstitches: [{ x1: 1, y1: 1, x2: 2, y2: 1, paletteIndex: 0 }] },
      });
      expect(prisma.pattern.update).toHaveBeenCalled();
    });

    it('rejects lines outside the grid', async () => {
      await expect(
        service.update('user-1', 'pat-1', {
          meta: { backstitches: [{ x1: 0, y1: 0, x2: 9, y2: 0, paletteIndex: 0 }] },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a shrink that would strand existing lines', async () => {
      await expect(
        service.update('user-1', 'pat-1', {
          width: 2,
          height: 2,
          grid: [[[null, 2]], [[null, 2]]],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
