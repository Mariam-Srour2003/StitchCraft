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
  /** Auto-improve the photo (contrast, saturation, denoise) before converting. */
  enhance?: boolean;
  /** Tidy the result: remove lone "confetti" stitches, merge barely-used colours. */
  cleanup?: boolean;
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
