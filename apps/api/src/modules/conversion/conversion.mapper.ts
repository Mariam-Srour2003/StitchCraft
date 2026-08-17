import type { ConversionJob as PrismaConversionJob } from '@prisma/client';
import type { ConversionJob, ConversionParams } from '@stitchcraft/types';

export function toConversionJobDto(job: PrismaConversionJob): ConversionJob {
  return {
    id: job.id,
    userId: job.userId,
    status: job.status,
    progress: job.progress,
    params: job.params as unknown as ConversionParams,
    resultPatternId: job.resultPatternId ?? undefined,
    error: job.error ?? undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
