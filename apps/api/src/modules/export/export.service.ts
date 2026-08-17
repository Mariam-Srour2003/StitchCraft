import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ExportResponse, Pattern } from '@stitchcraft/types';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { toPatternDto } from '../patterns/patterns.mapper';
import { STORAGE_ADAPTER, StorageAdapter } from '../storage/storage-adapter';
import { buildChartPdf } from './build-chart-pdf';
import { buildChartSvg } from './build-chart-svg';
import { buildMaterialsListCsv } from './build-materials-list';

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async generate(userId: string, patternId: string): Promise<ExportResponse> {
    const pattern = await this.getOwnedPattern(userId, patternId);

    const svg = buildChartSvg(pattern);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const pdf = await buildChartPdf(pattern);
    const csv = buildMaterialsListCsv(pattern);

    const prefix = `exports/${pattern.id}`;
    const [svgKey, pngKey, pdfKey, csvKey] = await Promise.all([
      this.storage.put(`${prefix}/chart.svg`, Buffer.from(svg), 'image/svg+xml'),
      this.storage.put(`${prefix}/chart.png`, png, 'image/png'),
      this.storage.put(`${prefix}/chart.pdf`, pdf, 'application/pdf'),
      this.storage.put(`${prefix}/materials.csv`, Buffer.from(csv), 'text/csv'),
    ]);

    return {
      svgUrl: this.storage.urlFor(svgKey),
      pngUrl: this.storage.urlFor(pngKey),
      pdfUrl: this.storage.urlFor(pdfKey),
      materialsListUrl: this.storage.urlFor(csvKey),
    };
  }

  private async getOwnedPattern(userId: string, patternId: string): Promise<Pattern> {
    const pattern = await this.prisma.pattern.findUnique({
      where: { id: patternId },
      include: { project: true },
    });
    if (!pattern) throw new NotFoundException('Pattern not found');
    if (pattern.project.userId !== userId) throw new ForbiddenException('You do not have access to this pattern');

    return toPatternDto(pattern);
  }
}
