import { Inject, Injectable } from '@nestjs/common';

import { AnalyzeImageParams, ImageAnalysis } from '@stitchcraft/types';

import { AI_PROVIDER, AiProvider } from './ai-provider';
import { analyzeImage } from './analyze-image';
import { buildGridFromPixels, BuildGridResult } from './build-grid-from-pixels';
import { stitchPixels } from './stitch-pixels';

export interface ConvertImageOptions {
  width: number;
  height: number;
  colorCount: number;
  useAiBackgroundRemoval?: boolean;
  useAiUpscale?: boolean;
  /** Stretch contrast, lift saturation and denoise before shrinking to stitch size. */
  enhance?: boolean;
  /** Remove confetti stitches and fold barely-used colours into close ones. */
  cleanup?: boolean;
}

@Injectable()
export class ImagingService {
  constructor(@Inject(AI_PROVIDER) private readonly aiProvider: AiProvider) {}

  async convertImageToGrid(
    imageBuffer: Buffer,
    opts: ConvertImageOptions,
  ): Promise<BuildGridResult> {
    let working = imageBuffer;

    // Both AI steps degrade gracefully: if requested but no provider is
    // configured, the classic pipeline just proceeds without them.
    if (opts.useAiBackgroundRemoval && this.aiProvider.isConfigured()) {
      working = await this.aiProvider.removeBackground(working);
    }
    if (opts.useAiUpscale && this.aiProvider.isConfigured()) {
      working = await this.aiProvider.upscale(working);
    }

    const pixels = await stitchPixels(working, opts.width, opts.height, opts.enhance);
    return buildGridFromPixels(pixels, opts.width, opts.height, opts.colorCount, {
      cleanup: opts.cleanup,
    });
  }

  /**
   * The image advisor: how well will this photo stitch at these settings,
   * and what would make it better? Runs the same pipeline as a conversion on
   * a small copy, plus face detection.
   */
  analyze(imageBuffer: Buffer, params: AnalyzeImageParams): Promise<ImageAnalysis> {
    return analyzeImage(imageBuffer, params);
  }
}
