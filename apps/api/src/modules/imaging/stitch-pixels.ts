import sharp from 'sharp';

import type { Rgb } from '@stitchcraft/types';

/**
 * Turns a photo into exactly width x height pixels, one per stitch: applies
 * the EXIF orientation, composites transparency onto white, optionally
 * enhances, and resizes. Shared by the converter and the image advisor so the
 * advisor's preview is what a conversion would really produce.
 */
export async function stitchPixels(
  buffer: Buffer,
  width: number,
  height: number,
  enhance = false,
): Promise<Rgb[]> {
  // .rotate() with no angle applies the EXIF orientation, so a phone photo
  // stored sideways with an "rotate me" tag converts the right way up.
  let image = sharp(buffer).rotate().flatten({ background: '#ffffff' });
  if (enhance) {
    const meta = await sharp(buffer).metadata();
    // EXIF orientations 5-8 swap width and height.
    const sideways = (meta.orientation ?? 1) >= 5;
    const sourceWidth = (sideways ? meta.height : meta.width) ?? width;
    const sourceHeight = (sideways ? meta.width : meta.height) ?? height;
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
