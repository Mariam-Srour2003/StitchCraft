import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from './ai-provider';

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

  private async postImage(path: string, image: Buffer): Promise<Buffer> {
    const baseUrl = this.baseUrl;
    if (!baseUrl) {
      // Should not happen if callers check isConfigured() first, but fail
      // closed (return the input unchanged) rather than throw, matching
      // NullAiProvider's graceful-degradation contract.
      this.logger.warn(`postImage(${path}) called with no AI_SERVICE_URL configured; returning input unchanged`);
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
