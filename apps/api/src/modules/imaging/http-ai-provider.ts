import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AnalyzeImageParams, VisionAdvice } from '@stitchcraft/types';

import { AiProvider, VisionAdviceError } from './ai-provider';

/** How long a status answer is trusted before asking the AI service again. */
const STATUS_TTL_MS = 60_000;

/**
 * Calls the optional `services/ai` FastAPI microservice when AI_SERVICE_URL
 * is configured. Uses Node's built-in fetch/FormData/Blob (stable since
 * Node 18, and this workspace already requires Node 20+) rather than
 * pulling in an HTTP client dependency for two simple POSTs.
 */
@Injectable()
export class HttpAiProvider implements AiProvider {
  private readonly logger = new Logger(HttpAiProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string | undefined {
    return this.config.get<string>('AI_SERVICE_URL')?.replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async removeBackground(image: Buffer): Promise<Buffer> {
    return this.postImage('/background-removal', image);
  }

  async upscale(image: Buffer): Promise<Buffer> {
    return this.postImage('/upscale', image);
  }

  private statusCache: { enabled: boolean; at: number } | null = null;

  async visionAdviceAvailable(): Promise<boolean> {
    const baseUrl = this.baseUrl;
    if (!baseUrl) return false;
    if (this.statusCache && Date.now() - this.statusCache.at < STATUS_TTL_MS) {
      return this.statusCache.enabled;
    }
    let enabled = false;
    try {
      const response = await fetch(`${baseUrl}/vision-advice/status`);
      enabled = response.ok && ((await response.json()) as { enabled?: unknown }).enabled === true;
    } catch (error) {
      this.logger.warn(`AI service status check failed: ${(error as Error).message}`);
    }
    this.statusCache = { enabled, at: Date.now() };
    return enabled;
  }

  async visionAdvice(image: Buffer, params: AnalyzeImageParams): Promise<VisionAdvice> {
    const baseUrl = this.baseUrl;
    if (!baseUrl) throw new VisionAdviceError('AI advice is not set up on this server', 503);

    const form = new FormData();
    form.append('file', new Blob([image]), 'image');
    form.append('target_type', params.targetType);
    form.append('width', String(params.width));
    form.append('height', String(params.height));
    form.append('color_count', String(params.colorCount));

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/vision-advice`, { method: 'POST', body: form });
    } catch (error) {
      this.logger.warn(`AI service unreachable: ${(error as Error).message}`);
      throw new VisionAdviceError('Could not reach the AI service', 502);
    }
    if (!response.ok) {
      // The service's own message is user-facing ("busy - try again", "declined").
      const detail = await response
        .json()
        .then((body: { detail?: unknown }) =>
          typeof body.detail === 'string' ? body.detail : null,
        )
        .catch(() => null);
      const status = response.status === 503 ? 503 : response.status >= 500 ? 502 : response.status;
      throw new VisionAdviceError(detail ?? 'AI advice failed', status);
    }
    return (await response.json()) as VisionAdvice;
  }

  private async postImage(path: string, image: Buffer): Promise<Buffer> {
    const baseUrl = this.baseUrl;
    if (!baseUrl) {
      // Should not happen if callers check isConfigured() first, but fail
      // closed (return the input unchanged) rather than throw, matching
      // NullAiProvider's graceful-degradation contract.
      this.logger.warn(
        `postImage(${path}) called with no AI_SERVICE_URL configured; returning input unchanged`,
      );
      return image;
    }

    const form = new FormData();
    form.append('file', new Blob([image]), 'image.png');

    const response = await fetch(`${baseUrl}${path}`, { method: 'POST', body: form });
    if (!response.ok) {
      throw new Error(`AI service request to ${path} failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
