import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageAdapter } from '../storage/storage-adapter';
import { ExportService } from './export.service';

jest.mock('sharp', () =>
  jest.fn(() => ({
    png: () => ({ toBuffer: () => Promise.resolve(Buffer.from('fake-png-bytes')) }),
  })),
);

describe('ExportService', () => {
  let service: ExportService;
  let prisma: { pattern: { findUnique: jest.Mock } };
  let storage: { put: jest.Mock; urlFor: jest.Mock };

  const ownedPattern = {
    id: 'pattern-1',
    projectId: 'proj-1',
    name: 'Test',
    type: 'cross_stitch',
    width: 2,
    height: 2,
    palette: [{ index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } }],
    grid: [
      [[0, 1], [null, 1]],
      [[null, 2]],
    ],
    meta: { createdFrom: 'blank' },
    project: { userId: 'user-1' },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    prisma = { pattern: { findUnique: jest.fn() } };
    storage = {
      put: jest.fn((key: string) => Promise.resolve(key)),
      urlFor: jest.fn((key: string) => `https://storage.local/${key}`),
    };
    service = new ExportService(prisma as unknown as PrismaService, storage as unknown as StorageAdapter);
  });

  it('throws NotFoundException for a missing pattern', async () => {
    prisma.pattern.findUnique.mockResolvedValueOnce(null);
    await expect(service.generate('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException for a pattern owned by another user', async () => {
    prisma.pattern.findUnique.mockResolvedValueOnce({ ...ownedPattern, project: { userId: 'someone-else' } });
    await expect(service.generate('user-1', 'pattern-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('stores all four export artifacts under a per-pattern prefix and returns their URLs', async () => {
    prisma.pattern.findUnique.mockResolvedValueOnce(ownedPattern);

    const result = await service.generate('user-1', 'pattern-1');

    const putKeys = storage.put.mock.calls.map((call) => call[0]);
    expect(putKeys).toEqual([
      'exports/pattern-1/chart.svg',
      'exports/pattern-1/chart.png',
      'exports/pattern-1/chart.pdf',
      'exports/pattern-1/materials.csv',
    ]);
    expect(result).toEqual({
      svgUrl: 'https://storage.local/exports/pattern-1/chart.svg',
      pngUrl: 'https://storage.local/exports/pattern-1/chart.png',
      pdfUrl: 'https://storage.local/exports/pattern-1/chart.pdf',
      materialsListUrl: 'https://storage.local/exports/pattern-1/materials.csv',
    });
  });

  it('stores the SVG/PNG/PDF/CSV with correct MIME types', async () => {
    prisma.pattern.findUnique.mockResolvedValueOnce(ownedPattern);
    await service.generate('user-1', 'pattern-1');

    const mimeTypes = storage.put.mock.calls.map((call) => call[2]);
    expect(mimeTypes).toEqual(['image/svg+xml', 'image/png', 'application/pdf', 'text/csv']);
  });
});
