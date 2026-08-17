import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { decodeGrid } from '@stitchcraft/types';
import { PrismaService } from '../../prisma/prisma.service';
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
        service.create('user-1', { projectId: 'proj-1', name: 'New', type: 'cross_stitch', width: 4, height: 4 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.pattern.create).not.toHaveBeenCalled();
    });

    it('rejects creating a pattern under a nonexistent project', async () => {
      prisma.project.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create('user-1', { projectId: 'missing', name: 'New', type: 'cross_stitch', width: 4, height: 4 }),
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
      await expect(service.findAllForProject('user-1', 'proj-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.pattern.findMany).not.toHaveBeenCalled();
    });

    it('rejects listing patterns for a nonexistent project', async () => {
      prisma.project.findUnique.mockResolvedValueOnce(null);
      await expect(service.findAllForProject('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
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
      await expect(service.findOne('someone-else', 'pattern-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
