import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConversionJob, ConversionParams } from '@stitchcraft/types';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_ADAPTER, StorageAdapter } from '../storage/storage-adapter';
import { CONVERSIONS_QUEUE, ConversionJobData } from './conversion-job-data';
import { toConversionJobDto } from './conversion.mapper';
import { CreateConversionDto } from './dto/create-conversion.dto';

@Injectable()
export class ConversionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    @InjectQueue(CONVERSIONS_QUEUE) private readonly queue: Queue<ConversionJobData>,
  ) {}

  async create(
    userId: string,
    dto: CreateConversionDto,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ jobId: string }> {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('You do not have access to this project');

    const sourceImageRef = `uploads/${userId}/${randomUUID()}-${file.originalname}`;
    await this.storage.put(sourceImageRef, file.buffer, file.mimetype);

    const params: ConversionParams = {
      sourceImageRef,
      targetType: dto.targetType,
      width: dto.width,
      height: dto.height,
      colorCount: dto.colorCount,
      useAiBackgroundRemoval: dto.useAiBackgroundRemoval,
      useAiUpscale: dto.useAiUpscale,
    };

    const conversionJob = await this.prisma.conversionJob.create({
      data: { userId, status: 'queued', progress: 0, params: params as unknown as object },
    });

    const patternName = file.originalname.replace(/\.[^./]+$/, '') || 'Converted pattern';
    await this.queue.add(
      'convert',
      { conversionJobId: conversionJob.id, projectId: dto.projectId, patternName },
      { jobId: conversionJob.id },
    );

    return { jobId: conversionJob.id };
  }

  async findOne(userId: string, id: string): Promise<ConversionJob> {
    const job = await this.prisma.conversionJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Conversion job not found');
    if (job.userId !== userId) throw new ForbiddenException('You do not have access to this job');
    return toConversionJobDto(job);
  }
}
