import type { ConversionParams } from '../models/conversion.model';

export interface CreateConversionDto extends ConversionParams {
  projectId: string;
}

export interface ConversionProgressEvent {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultPatternId?: string;
  error?: string;
}
