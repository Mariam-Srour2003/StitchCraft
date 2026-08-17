import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: {
    project: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const ownedProject = {
    id: 'p1',
    userId: 'user-1',
    name: 'My pattern',
    sourceImageRef: null,
    patterns: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new ProjectsService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException for a nonexistent project', async () => {
    prisma.project.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when the project belongs to another user', async () => {
    prisma.project.findUnique.mockResolvedValueOnce(ownedProject);
    await expect(service.findOne('someone-else', 'p1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns the project when owned by the requesting user', async () => {
    prisma.project.findUnique.mockResolvedValueOnce(ownedProject);
    const result = await service.findOne('user-1', 'p1');
    expect(result.id).toBe('p1');
    expect(result.patternIds).toEqual([]);
  });

  it('refuses to update a project owned by another user without ever calling update', async () => {
    prisma.project.findUnique.mockResolvedValueOnce(ownedProject);
    await expect(service.update('someone-else', 'p1', { name: 'x' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a project owned by another user without ever calling delete', async () => {
    prisma.project.findUnique.mockResolvedValueOnce(ownedProject);
    await expect(service.remove('someone-else', 'p1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.project.delete).not.toHaveBeenCalled();
  });
});
