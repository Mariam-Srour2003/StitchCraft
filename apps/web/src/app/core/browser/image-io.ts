import type { RgbaImage } from '@app/domain/image/image-ops';

/**
 * Decodes an image file into RGBA pixels, scaled so its long side is at most
 * `maxSide`. Browsers apply EXIF orientation when decoding, so the result is
 * the right way up (and carries no orientation tag any more).
 */
export async function loadImageFile(file: Blob, maxSide: number): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = context2d(width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return { width, height, data };
  } finally {
    bitmap.close();
  }
}

/** Encodes pixels as a JPEG (small uploads; quality is plenty for a stitch grid). */
export function encodeJpeg(img: RgbaImage, quality = 0.92): Promise<Blob> {
  const ctx = context2d(img.width, img.height);
  // Paint onto white so transparent areas don't turn black in the JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, img.width, img.height);
  const layer = context2d(img.width, img.height);
  layer.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  ctx.drawImage(layer.canvas, 0, 0);
  return new Promise((resolve, reject) =>
    ctx.canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      quality,
    ),
  );
}

/** Draws pixels into a canvas, resizing the canvas to fit them. */
export function paintToCanvas(canvas: HTMLCanvasElement, img: RgbaImage): void {
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
}

function context2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available');
  return ctx;
}
