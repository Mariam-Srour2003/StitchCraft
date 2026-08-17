import type { PatternType } from './pattern.model';

export type ConversionJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ConversionParams {
  sourceImageRef: string;
  targetType: PatternType;
  width: number;
  height: number;
  /** Number of colors to reduce the source image to. */
  colorCount: number;
  useAiBackgroundRemoval?: boolean;
  useAiUpscale?: boolean;
}

export interface ConversionJob {
  id: string;
  userId: string;
  status: ConversionJobStatus;
  progress: number;
  params: ConversionParams;
  resultPatternId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
