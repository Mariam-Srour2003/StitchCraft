export const CONVERSIONS_QUEUE = 'conversions';

/** BullMQ job payload; the job's own id is set equal to the ConversionJob DB row id. */
export interface ConversionJobData {
  conversionJobId: string;
  projectId: string;
  patternName: string;
}

/** Value the processor returns; BullMQ passes this to the 'completed' worker event. */
export interface ConversionJobResult {
  patternId: string;
}
