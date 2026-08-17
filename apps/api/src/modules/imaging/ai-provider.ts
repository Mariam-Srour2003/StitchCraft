export const AI_PROVIDER = Symbol('AI_PROVIDER');

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
}
