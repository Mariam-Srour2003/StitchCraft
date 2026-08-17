import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConversionParams } from '@stitchcraft/types';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { ImagingService } from '../imaging/imaging.service';
import { STORAGE_ADAPTER, StorageAdapter } from '../storage/storage-adapter';
import { CONVERSIONS_QUEUE, ConversionJobData, ConversionJobResult } from './conversion-job-data';
import { ConversionsGateway } from './conversion.gateway';

@Processor(CONVERSIONS_QUEUE)
export class ConversionsProcessor extends WorkerHost {
  private readonly logger = new Logger(ConversionsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imaging: ImagingService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    private readonly gateway: ConversionsGateway,
  ) {
    super();
  }

  async process(job: Job<ConversionJobData, ConversionJobResult>): Promise<ConversionJobResult> {
    const { conversionJobId, projectId, patternName } = job.data;
    const conversionJob = await this.prisma.conversionJob.findUniqueOrThrow({ where: { id: conversionJobId } });
    const params = conversionJob.params as unknown as ConversionParams;

    await job.updateProgress(10);
    const imageBuffer = await this.storage.get(params.sourceImageRef);

    await job.updateProgress(25);
    const { palette, grid } = await this.imaging.convertImageToGrid(imageBuffer, {
      width: params.width,
      height: params.height,
      colorCount: params.colorCount,
      useAiBackgroundRemoval: params.useAiBackgroundRemoval,
      useAiUpscale: params.useAiUpscale,
    });

    await job.updateProgress(85);
    const pattern = await this.prisma.pattern.create({
      data: {
        projectId,
        name: patternName,
        type: params.targetType,
        width: params.width,
        height: params.height,
        palette: palette as unknown as object[],
        grid: grid as unknown as object,
        meta: { createdFrom: 'conversion', sourceConversionJobId: conversionJobId },
      },
    });

    await job.updateProgress(100);
    return { patternId: pattern.id };
  }

  @OnWorkerEvent('active')
  async onActive(job: Job<ConversionJobData>): Promise<void> {
    await this.prisma.conversionJob.update({
      where: { id: job.data.conversionJobId },
      data: { status: 'processing' },
    });
    this.gateway.emit(job.data.conversionJobId, {
      jobId: job.data.conversionJobId,
      status: 'processing',
      progress: 0,
    });
  }

  @OnWorkerEvent('progress')
  async onProgress(job: Job<ConversionJobData>, progress: number | object): Promise<void> {
    const value = typeof progress === 'number' ? progress : 0;
    await this.prisma.conversionJob.update({ where: { id: job.data.conversionJobId }, data: { progress: value } });
    this.gateway.emit(job.data.conversionJobId, {
      jobId: job.data.conversionJobId,
      status: 'processing',
      progress: value,
    });
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<ConversionJobData>, result: ConversionJobResult): Promise<void> {
    await this.prisma.conversionJob.update({
      where: { id: job.data.conversionJobId },
      data: { status: 'completed', progress: 100, resultPatternId: result.patternId },
    });
    this.gateway.emit(job.data.conversionJobId, {
      jobId: job.data.conversionJobId,
      status: 'completed',
      progress: 100,
      resultPatternId: result.patternId,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ConversionJobData> | undefined, error: Error): Promise<void> {
    if (!job) {
      this.logger.error(`Conversion job failed before job data was available: ${error.message}`);
      return;
    }
    await this.prisma.conversionJob.update({
      where: { id: job.data.conversionJobId },
      data: { status: 'failed', error: error.message },
    });
    this.gateway.emit(job.data.conversionJobId, {
      jobId: job.data.conversionJobId,
      status: 'failed',
      progress: typeof job.progress === 'number' ? job.progress : 0,
      error: error.message,
    });
  }
}
