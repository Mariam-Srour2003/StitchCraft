import { Inject, Injectable } from '@nestjs/common';
import { Rgb } from '@stitchcraft/types';
import sharp from 'sharp';
import { AI_PROVIDER, AiProvider } from './ai-provider';
import { BuildGridResult, buildGridFromPixels } from './build-grid-from-pixels';

export interface ConvertImageOptions {
  width: number;
  height: number;
  colorCount: number;
  useAiBackgroundRemoval?: boolean;
  useAiUpscale?: boolean;
}

@Injectable()
export class ImagingService {
  constructor(@Inject(AI_PROVIDER) private readonly aiProvider: AiProvider) {}

  async convertImageToGrid(imageBuffer: Buffer, opts: ConvertImageOptions): Promise<BuildGridResult> {
    let working = imageBuffer;

    // Both AI steps degrade gracefully: if requested but no provider is
    // configured, the classic pipeline just proceeds without them.
    if (opts.useAiBackgroundRemoval && this.aiProvider.isConfigured()) {
      working = await this.aiProvider.removeBackground(working);
    }
    if (opts.useAiUpscale && this.aiProvider.isConfigured()) {
      working = await this.aiProvider.upscale(working);
    }

    const pixels = await this.extractPixels(working, opts.width, opts.height);
    return buildGridFromPixels(pixels, opts.width, opts.height, opts.colorCount);
  }

  /** Resizes to exactly width x height (one output pixel per stitch cell) and reads raw RGB bytes. */
  private async extractPixels(buffer: Buffer, width: number, height: number): Promise<Rgb[]> {
    const { data, info } = await sharp(buffer)
      .flatten({ background: '#ffffff' }) // composite any transparency onto white before quantizing
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels: Rgb[] = new Array(width * height);
    const channels = info.channels;
    for (let i = 0; i < pixels.length; i++) {
      const offset = i * channels;
      pixels[i] = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
    }
    return pixels;
  }
}
