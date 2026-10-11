import { Inject, Injectable } from '@nestjs/common';
import sharp from 'sharp';

import { Rgb } from '@stitchcraft/types';

import { AI_PROVIDER, AiProvider } from './ai-provider';
import { buildGridFromPixels, BuildGridResult } from './build-grid-from-pixels';

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

    const pixels = await this.extractPixels(working, opts.width, opts.height, !!opts.enhance);
    return buildGridFromPixels(pixels, opts.width, opts.height, opts.colorCount, {
      cleanup: opts.cleanup,
    });
  }

  /** Resizes to exactly width x height (one output pixel per stitch cell) and reads raw RGB bytes. */
  private async extractPixels(
    buffer: Buffer,
    width: number,
    height: number,
    enhance: boolean,
  ): Promise<Rgb[]> {
    // .rotate() with no angle applies the EXIF orientation, so a phone photo
    // stored sideways with an "rotate me" tag converts the right way up.
    let image = sharp(buffer).rotate().flatten({ background: '#ffffff' }); // transparency onto white
    if (enhance) {
      const { width: sourceWidth = width, height: sourceHeight = height } =
        await sharp(buffer).metadata();
      // Thread colours read duller than screen colours, and quantizing a
      // flat, washed-out photo wastes colours on near-identical greys.
      image = image.normalise({ lower: 1, upper: 99 }).modulate({ saturation: 1.15 });
      // Sensor/JPEG noise turns into confetti; a small median removes it
      // without softening edges. Only worth it when we're shrinking a lot.
      if (sourceWidth >= width * 3 && sourceHeight >= height * 3) image = image.median(3);
    }
    const { data, info } = await image
      .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
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
