import { Injectable } from '@nestjs/common';

import type { AnalyzeImageParams, VisionAdvice } from '@stitchcraft/types';

import { AiProvider, VisionAdviceError } from './ai-provider';

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

  async visionAdviceAvailable(): Promise<boolean> {
    return false;
  }

  async visionAdvice(_image: Buffer, _params: AnalyzeImageParams): Promise<VisionAdvice> {
    throw new VisionAdviceError('AI advice is not set up on this server', 503);
  }
}
