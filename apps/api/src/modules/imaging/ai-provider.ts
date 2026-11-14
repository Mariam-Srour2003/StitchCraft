import type { AnalyzeImageParams, VisionAdvice } from '@stitchcraft/types';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

/** Why an AI second opinion couldn't be given, with an HTTP status to report it as. */
export class VisionAdviceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Seam for optional AI-assisted conversion steps (background removal,
 * super-resolution). Implementations call out to the `services/ai` Python
 * microservice (M5); until that's configured, `NullAiProvider` is the
 * default so the classic pipeline works with zero AI configuration, per
 * PLAN.md's "must fully work without it" requirement.
 */
export interface AiProvider {
  isConfigured(): boolean;
  removeBackground(image: Buffer): Promise<Buffer>;
  upscale(image: Buffer): Promise<Buffer>;
  /** Whether an AI second opinion on photos is switched on in the AI service. */
  visionAdviceAvailable(): Promise<boolean>;
  /** AI second opinion on a photo; throws VisionAdviceError when it can't be given. */
  visionAdvice(image: Buffer, params: AnalyzeImageParams): Promise<VisionAdvice>;
}
