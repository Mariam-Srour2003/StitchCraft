/**
 * Photo preparation before conversion: rotate, flip, crop and tone
 * adjustments, as pure functions on RGBA buffers (the layout of canvas
 * ImageData), so they're testable without a browser.
 */

import type { RelativeBox } from '@stitchcraft/types';

export interface RgbaImage {
  width: number;
  height: number;
  /** 4 bytes per pixel, row-major - same layout as ImageData.data. */
  data: Uint8ClampedArray;
}

export type Rotation = 0 | 90 | 180 | 270;

/** Each -100..100, 0 = unchanged. */
export interface PhotoAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface PhotoEdits {
  /** Clockwise. Applied first, then flips, then crop, then adjustments. */
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  /** Relative to the rotated and flipped image; null = whole photo. */
  crop: RelativeBox | null;
  adjust: PhotoAdjustments;
}

export const NO_ADJUSTMENTS: PhotoAdjustments = { brightness: 0, contrast: 0, saturation: 0 };

export const NO_EDITS: PhotoEdits = {
  rotation: 0,
  flipH: false,
  flipV: false,
  crop: null,
  adjust: NO_ADJUSTMENTS,
};

export function hasEdits(edits: PhotoEdits): boolean {
  const { brightness, contrast, saturation } = edits.adjust;
  return (
    edits.rotation !== 0 ||
    edits.flipH ||
    edits.flipV ||
    edits.crop !== null ||
    brightness !== 0 ||
    contrast !== 0 ||
    saturation !== 0
  );
}

export function createImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function rotate(img: RgbaImage, rotation: Rotation): RgbaImage {
  if (rotation === 0) return img;
  const sideways = rotation === 90 || rotation === 270;
  const out = createImage(sideways ? img.height : img.width, sideways ? img.width : img.height);
  const src = new Uint32Array(img.data.buffer, img.data.byteOffset, img.width * img.height);
  const dst = new Uint32Array(out.data.buffer);
  const { width: w, height: h } = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx: number;
      let ny: number;
      if (rotation === 90) {
        nx = h - 1 - y;
        ny = x;
      } else if (rotation === 180) {
        nx = w - 1 - x;
        ny = h - 1 - y;
      } else {
        nx = y;
        ny = w - 1 - x;
      }
      dst[ny * out.width + nx] = src[y * w + x];
    }
  }
  return out;
}

export function flip(img: RgbaImage, horizontal: boolean, vertical: boolean): RgbaImage {
  if (!horizontal && !vertical) return img;
  const out = createImage(img.width, img.height);
  const src = new Uint32Array(img.data.buffer, img.data.byteOffset, img.width * img.height);
  const dst = new Uint32Array(out.data.buffer);
  const { width: w, height: h } = img;
  for (let y = 0; y < h; y++) {
    const sy = vertical ? h - 1 - y : y;
    for (let x = 0; x < w; x++) {
      dst[y * w + x] = src[sy * w + (horizontal ? w - 1 - x : x)];
    }
  }
  return out;
}

/** The pixel rectangle a relative box covers, at least 1x1 and inside the image. */
export function boxToPixels(
  box: RelativeBox,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(width - 1, Math.max(0, Math.round(box.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.round(box.y * height)));
  return {
    x,
    y,
    width: Math.max(1, Math.min(width - x, Math.round(box.width * width))),
    height: Math.max(1, Math.min(height - y, Math.round(box.height * height))),
  };
}

export function crop(img: RgbaImage, box: RelativeBox | null): RgbaImage {
  if (!box) return img;
  const r = boxToPixels(box, img.width, img.height);
  if (r.x === 0 && r.y === 0 && r.width === img.width && r.height === img.height) return img;
  const out = createImage(r.width, r.height);
  for (let y = 0; y < r.height; y++) {
    const start = ((r.y + y) * img.width + r.x) * 4;
    out.data.set(img.data.subarray(start, start + r.width * 4), y * r.width * 4);
  }
  return out;
}

/**
 * Brightness shifts every channel, contrast scales around mid-grey (the
 * usual 259-based curve), saturation pushes each channel away from (or
 * towards) the pixel's luma. Alpha is untouched.
 */
export function adjust(img: RgbaImage, a: PhotoAdjustments): RgbaImage {
  if (a.brightness === 0 && a.contrast === 0 && a.saturation === 0) return img;
  const c = a.contrast * 2.55;
  const contrastFactor = (259 * (c + 255)) / (255 * (259 - c));
  const shift = a.brightness * 1.28;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = (v - 128) * contrastFactor + 128 + shift;

  const sat = 1 + a.saturation / 100;
  const out = createImage(img.width, img.height);
  const src = img.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const r = lut[src[i]];
    const g = lut[src[i + 1]];
    const b = lut[src[i + 2]];
    if (sat === 1) {
      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
    } else {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      dst[i] = luma + (r - luma) * sat;
      dst[i + 1] = luma + (g - luma) * sat;
      dst[i + 2] = luma + (b - luma) * sat;
    }
    dst[i + 3] = src[i + 3];
  }
  return out;
}

/** Rotation and flips only - what the crop box is drawn over. */
export function applyGeometry(img: RgbaImage, edits: PhotoEdits): RgbaImage {
  return flip(rotate(img, edits.rotation), edits.flipH, edits.flipV);
}

/** Rotation and flips, then tone - the photo the user sees while choosing a crop. */
export function applyPreview(img: RgbaImage, edits: PhotoEdits): RgbaImage {
  return adjust(applyGeometry(img, edits), edits.adjust);
}

/** Every edit, in order: what gets converted. */
export function applyEdits(img: RgbaImage, edits: PhotoEdits): RgbaImage {
  return adjust(crop(applyGeometry(img, edits), edits.crop), edits.adjust);
}

/** Width / height of the photo after rotation and crop. */
export function editedAspect(sourceWidth: number, sourceHeight: number, edits: PhotoEdits): number {
  const sideways = edits.rotation === 90 || edits.rotation === 270;
  const w = sideways ? sourceHeight : sourceWidth;
  const h = sideways ? sourceWidth : sourceHeight;
  const box = edits.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  return (w * box.width) / (h * box.height);
}

/**
 * Box-filter downscale so the long side is at most `maxSide` (returns the
 * image itself when already small enough). Averaging every source pixel,
 * not sampling, so fine detail doesn't alias.
 */
export function downscale(img: RgbaImage, maxSide: number): RgbaImage {
  const scale = maxSide / Math.max(img.width, img.height);
  if (scale >= 1) return img;
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const sums = new Float64Array(width * height * 4);
  const counts = new Float64Array(width * height);
  for (let y = 0; y < img.height; y++) {
    const ty = Math.min(height - 1, Math.floor((y * height) / img.height));
    for (let x = 0; x < img.width; x++) {
      const tx = Math.min(width - 1, Math.floor((x * width) / img.width));
      const t = ty * width + tx;
      const s = (y * img.width + x) * 4;
      sums[t * 4] += img.data[s];
      sums[t * 4 + 1] += img.data[s + 1];
      sums[t * 4 + 2] += img.data[s + 2];
      sums[t * 4 + 3] += img.data[s + 3];
      counts[t]++;
    }
  }
  const out = createImage(width, height);
  for (let t = 0; t < counts.length; t++) {
    for (let c = 0; c < 4; c++) out.data[t * 4 + c] = sums[t * 4 + c] / counts[t];
  }
  return out;
}

// --- crop boxes ----------------------------------------------------------------

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The box spanned by two relative points (any drag direction). */
export function boxFromPoints(ax: number, ay: number, bx: number, by: number): RelativeBox {
  const x0 = clamp01(Math.min(ax, bx));
  const y0 = clamp01(Math.min(ay, by));
  return {
    x: x0,
    y: y0,
    width: clamp01(Math.max(ax, bx)) - x0,
    height: clamp01(Math.max(ay, by)) - y0,
  };
}

/**
 * Drag-to-crop with a fixed shape: the box from anchor (ax, ay) towards
 * (bx, by) with pixel aspect `aspect` (width / height), on a photo of
 * `imageAspect`, kept inside the photo.
 */
export function boxFromPointsWithAspect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  aspect: number,
  imageAspect: number,
): RelativeBox {
  // In relative units a box of pixel aspect `aspect` has width/height ratio:
  const ratio = aspect / imageAspect;
  const dirX = bx >= ax ? 1 : -1;
  const dirY = by >= ay ? 1 : -1;
  const roomX = dirX > 0 ? 1 - ax : ax;
  const roomY = dirY > 0 ? 1 - ay : ay;
  let width = Math.min(Math.abs(bx - ax), roomX);
  let height = Math.min(Math.abs(by - ay), roomY);
  // Let the larger drag direction lead, then fit the other side to it.
  if (width / ratio >= height) height = width / ratio;
  else width = height * ratio;
  if (height > roomY) {
    height = roomY;
    width = height * ratio;
  }
  if (width > roomX) {
    width = roomX;
    height = width / ratio;
  }
  return {
    x: dirX > 0 ? ax : ax - width,
    y: dirY > 0 ? ay : ay - height,
    width,
    height,
  };
}

/** Moves a box by (dx, dy), stopping at the photo's edges. */
export function moveBox(box: RelativeBox, dx: number, dy: number): RelativeBox {
  return {
    ...box,
    x: Math.min(1 - box.width, Math.max(0, box.x + dx)),
    y: Math.min(1 - box.height, Math.max(0, box.y + dy)),
  };
}

/**
 * The largest centred box of pixel aspect `aspect` on a photo of
 * `imageAspect` - what choosing a crop shape starts from.
 */
export function centeredBox(aspect: number, imageAspect: number): RelativeBox {
  const ratio = aspect / imageAspect;
  const width = ratio >= 1 ? 1 : ratio;
  const height = ratio >= 1 ? 1 / ratio : 1;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

/**
 * A box given relative to an already-cropped photo, expressed relative to the
 * uncropped one - e.g. the advisor's "crop to the face" on a photo the user
 * has already cropped.
 */
export function composeCrop(outer: RelativeBox | null, inner: RelativeBox): RelativeBox {
  if (!outer) return inner;
  return {
    x: outer.x + inner.x * outer.width,
    y: outer.y + inner.y * outer.height,
    width: inner.width * outer.width,
    height: inner.height * outer.height,
  };
}
