import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider';

/** Default AiProvider: every step is a passthrough. Swapped for a real HTTP-backed provider in M5. */
@Injectable()
export class NullAiProvider implements AiProvider {
  isConfigured(): boolean {
    return false;
  }

  async removeBackground(image: Buffer): Promise<Buffer> {
    return image;
  }

  async upscale(image: Buffer): Promise<Buffer> {
    return image;
  }
}
