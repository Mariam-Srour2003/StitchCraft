import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StorageAdapter } from '../storage/storage-adapter';
import { ConversionsService } from './conversion.service';

describe('ConversionsService', () => {
  let service: ConversionsService;
  let prisma: {
    project: { findUnique: jest.Mock };
    conversionJob: { create: jest.Mock; findUnique: jest.Mock };
  };
  let storage: { put: jest.Mock };
  let queue: { add: jest.Mock };

  const file = {
    buffer: Buffer.from('fake-image-bytes'),
    originalname: 'cat.png',
    mimetype: 'image/png',
  };

  beforeEach(() => {
    prisma = {
      project: { findUnique: jest.fn() },
      conversionJob: { create: jest.fn(), findUnique: jest.fn() },
    };
    storage = { put: jest.fn() };
    queue = { add: jest.fn() };
    service = new ConversionsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageAdapter,
      queue as never,
    );
  });

  describe('create', () => {
    const dto = {
      projectId: 'proj-1',
      targetType: 'cross_stitch' as const,
      width: 40,
      height: 40,
      colorCount: 12,
    };

    it('rejects converting into a project owned by another user', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({ id: 'proj-1', userId: 'someone-else' });
      await expect(service.create('user-1', dto, file)).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.put).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('rejects converting into a nonexistent project', async () => {
      prisma.project.findUnique.mockResolvedValueOnce(null);
      await expect(service.create('user-1', dto, file)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('stores the upload, creates a queued job row, and enqueues work with matching ids', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({ id: 'proj-1', userId: 'user-1' });
      prisma.conversionJob.create.mockResolvedValueOnce({ id: 'job-1' });

      const result = await service.create('user-1', dto, file);

      expect(result).toEqual({ jobId: 'job-1' });
      expect(storage.put).toHaveBeenCalledWith(
        expect.stringContaining('uploads/user-1/'),
        file.buffer,
        'image/png',
      );

      const [createArgs] = prisma.conversionJob.create.mock.calls[0];
      expect(createArgs.data.status).toBe('queued');
      expect(createArgs.data.progress).toBe(0);
      expect(createArgs.data.params.sourceImageRef).toEqual(
        expect.stringContaining('uploads/user-1/'),
      );

      const [, jobPayload, jobOptions] = queue.add.mock.calls[0];
      expect(jobPayload.conversionJobId).toBe('job-1');
      expect(jobPayload.projectId).toBe('proj-1');
      expect(jobOptions.jobId).toBe('job-1'); // DB row id and BullMQ job id are kept in sync
    });

    it('derives the pattern name from the uploaded filename', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({ id: 'proj-1', userId: 'user-1' });
      prisma.conversionJob.create.mockResolvedValueOnce({ id: 'job-1' });

      await service.create('user-1', dto, file);

      const [, jobPayload] = queue.add.mock.calls[0];
      expect(jobPayload.patternName).toBe('cat');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a missing job', async () => {
      prisma.conversionJob.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException for a job owned by another user', async () => {
      prisma.conversionJob.findUnique.mockResolvedValueOnce({
        id: 'job-1',
        userId: 'someone-else',
      });
      await expect(service.findOne('user-1', 'job-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns the job for its owner', async () => {
      prisma.conversionJob.findUnique.mockResolvedValueOnce({
        id: 'job-1',
        userId: 'user-1',
        status: 'processing',
        progress: 42,
        params: {
          sourceImageRef: 'x',
          targetType: 'cross_stitch',
          width: 40,
          height: 40,
          colorCount: 12,
        },
        resultPatternId: null,
        error: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      const job = await service.findOne('user-1', 'job-1');
      expect(job.progress).toBe(42);
      expect(job.resultPatternId).toBeUndefined();
    });
  });
});
