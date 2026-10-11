import sharp from 'sharp';

import type {
  AdviceFix,
  AnalyzeImageParams,
  DetectedFace,
  ImageAdvice,
  ImageAnalysis,
  ImageMetrics,
  RelativeBox,
  Rgb,
} from '@stitchcraft/types';
import {
  computeRegions,
  decodeGrid,
  MAX_PATTERN_DIMENSION,
  removeStrayStitches,
} from '@stitchcraft/types';

import { buildGridFromPixels } from './build-grid-from-pixels';
import cascadeJson from './faces/frontalface-alt2.json';
import type { Box, GrayImage, HaarCascade } from './faces/haar-cascade';
import { detectMultiScale, toGray } from './faces/haar-cascade';

const FACE_CASCADE = cascadeJson as unknown as HaarCascade;

/** Faces are searched for on a copy this big (long side); smaller faces than ~5% of it are missed. */
const FACE_SEARCH_SIZE = 640;
/** The test conversion is capped at this many cells; metrics are proportions so they carry over. */
const SIMULATION_CELLS = 120 * 120;

/**
 * How tall (in stitches) the detector's face box - roughly brows to chin -
 * has to be. Below ~10 the eyes are a single stitch each and a face is just
 * a skin-coloured blob; around 18 eyes, nose and mouth are distinct; from
 * ~28 there's room for shading.
 */
export const FACE_STITCHES = { unrecognisable: 10, simplified: 18, good: 28 } as const;

/** Everything the advice rules need, measured from the photo. */
export interface ImageMeasurements {
  source: { width: number; height: number };
  /** Laplacian variance at ~3 px per stitch (detail finer than a stitch is lost anyway). */
  sharpness: number;
  brightness: number;
  contrast: number;
  clipped: number;
  confetti: number;
  colorsUsed: number;
  averageRegionSize: number;
  faces: RelativeBox[];
}

// --- measuring ---------------------------------------------------------------

export async function measureImage(
  buffer: Buffer,
  target: AnalyzeImageParams,
): Promise<ImageMeasurements> {
  // .rotate() applies EXIF orientation, matching the conversion pipeline.
  const oriented = await sharp(buffer).rotate().flatten({ background: '#ffffff' }).toBuffer();
  const { width: sourceWidth = 1, height: sourceHeight = 1 } = await sharp(oriented).metadata();

  const [faces, tone, sharpness, simulation] = await Promise.all([
    findFaces(oriented, sourceWidth, sourceHeight),
    measureTone(oriented),
    measureSharpness(oriented, target),
    simulateConversion(oriented, target),
  ]);

  return {
    source: { width: sourceWidth, height: sourceHeight },
    sharpness,
    ...tone,
    ...simulation,
    faces,
  };
}

async function rawRgb(
  image: sharp.Sharp,
): Promise<{ data: Buffer; width: number; height: number; channels: number }> {
  const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

async function findFaces(
  oriented: Buffer,
  sourceWidth: number,
  sourceHeight: number,
): Promise<RelativeBox[]> {
  const scale = Math.min(1, FACE_SEARCH_SIZE / Math.max(sourceWidth, sourceHeight));
  const { data, width, height, channels } = await rawRgb(
    sharp(oriented).resize(
      Math.max(1, Math.round(sourceWidth * scale)),
      Math.max(1, Math.round(sourceHeight * scale)),
      { fit: 'fill' },
    ),
  );
  if (width < 24 || height < 24) return [];
  const gray = toGray(data, width, height, channels);
  return detectMultiScale(FACE_CASCADE, gray, { minNeighbors: 3 }).map((box: Box) => ({
    x: box.x / width,
    y: box.y / height,
    width: box.width / width,
    height: box.height / height,
  }));
}

async function measureTone(
  oriented: Buffer,
): Promise<Pick<ImageMeasurements, 'brightness' | 'contrast' | 'clipped'>> {
  const { data, width, height, channels } = await rawRgb(
    sharp(oriented).resize(256, 256, { fit: 'inside' }),
  );
  const gray = toGray(data, width, height, channels).data;
  const histogram = new Array<number>(256).fill(0);
  let total = 0;
  for (const v of gray) {
    histogram[v]++;
    total += v;
  }
  const percentile = (p: number) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += histogram[v];
      if (seen >= p * gray.length) return v;
    }
    return 255;
  };
  let clipped = 0;
  for (let v = 0; v <= 4; v++) clipped += histogram[v] + histogram[255 - v];
  return {
    brightness: total / gray.length / 255,
    // 1st-99th so a large plain background doesn't read as "no contrast".
    contrast: (percentile(0.99) - percentile(0.01)) / 255,
    clipped: clipped / gray.length,
  };
}

async function measureSharpness(oriented: Buffer, target: AnalyzeImageParams): Promise<number> {
  // Judge blur at the scale the pattern can show: ~3 px per stitch.
  const w = Math.max(16, Math.min(400, target.width * 3));
  const h = Math.max(16, Math.min(400, target.height * 3));
  const { data, width, height, channels } = await rawRgb(
    sharp(oriented).resize(w, h, { fit: 'fill' }),
  );
  return laplacianVariance(toGray(data, width, height, channels));
}

export function laplacianVariance(img: GrayImage): number {
  const { width, height, data } = img;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = data[i - 1] + data[i + 1] + data[i - width] + data[i + width] - 4 * data[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

async function simulateConversion(
  oriented: Buffer,
  target: AnalyzeImageParams,
): Promise<Pick<ImageMeasurements, 'confetti' | 'colorsUsed' | 'averageRegionSize'>> {
  const shrink = Math.min(1, Math.sqrt(SIMULATION_CELLS / (target.width * target.height)));
  const width = Math.max(1, Math.round(target.width * shrink));
  const height = Math.max(1, Math.round(target.height * shrink));
  const { data, channels } = await rawRgb(sharp(oriented).resize(width, height, { fit: 'fill' }));
  const pixels: Rgb[] = new Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    const o = i * channels;
    pixels[i] = { r: data[o], g: data[o + 1], b: data[o + 2] };
  }
  const { palette, grid } = buildGridFromPixels(pixels, width, height, target.colorCount);
  const rows = decodeGrid(grid, width);
  const { changed } = removeStrayStitches(rows);
  const { regions } = computeRegions(rows, width, height);
  return {
    confetti: changed / (width * height),
    colorsUsed: palette.length,
    averageRegionSize: (width * height) / Math.max(1, regions.length),
  };
}

// --- advising (pure) ----------------------------------------------------------

const SEVERITY_ORDER = { problem: 0, warning: 1, info: 2, good: 3 } as const;
const SEVERITY_PENALTY = { problem: 30, warning: 12, info: 3, good: 0 } as const;

const clampDimension = (n: number) => Math.max(1, Math.min(MAX_PATTERN_DIMENSION, Math.round(n)));

/**
 * Turns measurements into plain-language advice, a score and a suggested set
 * of converter settings. Pure, so every rule is unit-tested directly.
 */
export function adviseFromMeasurements(
  m: ImageMeasurements,
  target: AnalyzeImageParams,
): ImageAnalysis {
  const advice: ImageAdvice[] = [];
  const add = (item: ImageAdvice) => advice.push(item);
  const isPhotoCraft = target.targetType !== 'color_by_number';
  const sourceAspect = m.source.width / m.source.height;
  const targetAspect = target.width / target.height;

  // Size that keeps the photo's proportions at the requested width.
  const proportionalHeight = clampDimension(target.width / sourceAspect);

  // 1. Proportions
  const stretch = targetAspect / sourceAspect - 1;
  if (Math.abs(stretch) > 0.04) {
    add({
      code: 'aspect-mismatch',
      severity: Math.abs(stretch) > 0.15 ? 'problem' : 'warning',
      title: `The picture will be ${stretch > 0 ? 'stretched sideways' : 'squashed sideways'} by ${Math.round(Math.abs(stretch) * 100)}%`,
      detail:
        `The photo is ${m.source.width}x${m.source.height} but the pattern is ${target.width}x${target.height} stitches. ` +
        'Faces and round things look wrong when stretched. Keep the proportions, or crop the photo to the shape you want.',
      fix: { kind: 'size', width: target.width, height: proportionalHeight },
      fixLabel: `Use ${target.width} x ${proportionalHeight}`,
    });
  }

  // 2. Resolution
  const pixelsPerStitch = Math.min(m.source.width / target.width, m.source.height / target.height);
  if (pixelsPerStitch < 1) {
    const width = clampDimension(Math.min(target.width, m.source.width));
    add({
      code: 'low-resolution',
      severity: 'problem',
      title: 'The photo is smaller than the pattern',
      detail:
        `There is less than one photo pixel per stitch, so the pattern will be made of blurry, blocky guesses. ` +
        `Use a bigger photo, or make the pattern at most ${m.source.width} stitches wide.`,
      fix: { kind: 'size', width, height: clampDimension(width / sourceAspect) },
      fixLabel: `Shrink to ${width} wide`,
    });
  } else if (pixelsPerStitch < 2) {
    add({
      code: 'borderline-resolution',
      severity: 'info',
      title: 'Only just enough pixels',
      detail:
        'Each stitch is made from one or two photo pixels, so edges may look jagged. A larger original photo will give cleaner lines.',
    });
  }

  // 3. Faces
  const faces: DetectedFace[] = m.faces.map((box) => ({
    box,
    stitchHeight: Math.round(box.height * target.height),
  }));
  if (faces.length > 0) {
    const largest = Math.max(...faces.map((f) => f.stitchHeight));
    const smallest = Math.min(...faces.map((f) => f.stitchHeight));
    const who = faces.length === 1 ? 'The face' : `The ${faces.length} faces`;
    const crop = headAndShoulders(
      faces.map((f) => f.box),
      targetAspect,
      sourceAspect,
    );
    const growFactor = FACE_STITCHES.good / Math.max(1, largest);
    const grownWidth = clampDimension(target.width * growFactor);
    const grownHeight = clampDimension(grownWidth / sourceAspect);
    const sizeFix: AdviceFix | undefined =
      growFactor > 1 && target.width * growFactor <= MAX_PATTERN_DIMENSION
        ? { kind: 'size', width: grownWidth, height: grownHeight }
        : undefined;

    if (largest < FACE_STITCHES.unrecognisable) {
      add({
        code: 'face-too-small',
        severity: 'problem',
        title: `${who} will be too small to recognise`,
        detail:
          `${faces.length === 1 ? 'It' : 'The biggest'} will be only about ${largest} stitches tall, so eyes, nose and mouth shrink to a stitch or less and the face becomes a blur of skin colour. ` +
          'People who are far away in a photo nearly always stitch badly. Crop in close to the face, or make the pattern much bigger.',
        fix: crop ? { kind: 'crop', box: crop } : sizeFix,
        fixLabel: crop ? 'Crop to the face' : sizeFix ? `Enlarge to ${grownWidth} wide` : undefined,
      });
    } else if (largest < FACE_STITCHES.simplified) {
      add({
        code: 'face-small',
        severity: 'warning',
        title: `${who} will be very simplified`,
        detail:
          `About ${largest} stitches tall: you'll see where the eyes and mouth are, but not who it is. ` +
          `Aim for at least ${FACE_STITCHES.good} stitches - crop closer or make the pattern bigger.`,
        fix: crop ? { kind: 'crop', box: crop } : sizeFix,
        fixLabel: crop ? 'Crop to the face' : sizeFix ? `Enlarge to ${grownWidth} wide` : undefined,
      });
    } else if (largest < FACE_STITCHES.good) {
      add({
        code: 'face-ok',
        severity: 'info',
        title: `${who} will be recognisable but simple`,
        detail: `About ${largest} stitches tall. Fine features and soft shading will be lost; a bigger pattern keeps more of them.`,
        fix: sizeFix,
        fixLabel: sizeFix ? `Enlarge to ${grownWidth} wide` : undefined,
      });
    } else {
      add({
        code: 'face-good',
        severity: 'good',
        title: `${who} ${faces.length === 1 ? 'is' : 'are'} a good size`,
        detail: `About ${largest} stitches tall - enough room for eyes, shading and expression.`,
      });
    }
    if (
      faces.length > 1 &&
      smallest < FACE_STITCHES.unrecognisable &&
      largest >= FACE_STITCHES.unrecognisable
    ) {
      add({
        code: 'faces-uneven',
        severity: 'info',
        title: 'Some faces are much smaller than others',
        detail: `The smallest face will be about ${smallest} stitches tall and will lose its features. Group photos work best when everyone is about the same distance away.`,
      });
    }
    if (isPhotoCraft && target.colorCount < 20) {
      add({
        code: 'skin-needs-colors',
        severity: 'info',
        title: 'Skin needs a few more colours',
        detail:
          'With fewer than ~20 colours, skin shading turns into hard bands. 24-30 colours usually look natural.',
        fix: { kind: 'colors', colorCount: 24 },
        fixLabel: 'Use 24 colours',
      });
    }
  }

  // 4. Sharpness (at stitch scale)
  if (m.sharpness < 60) {
    add({
      code: 'blurry',
      severity: m.sharpness < 25 ? 'problem' : 'warning',
      title: 'The photo is blurry at this size',
      detail:
        'Soft edges turn into wide bands of in-between colours. Use a sharper photo, or a smaller pattern (blur matters less when each stitch covers more of the photo).',
    });
  }

  // 5. Light and contrast
  if (m.brightness < 0.25) {
    add({
      code: 'too-dark',
      severity: 'warning',
      title: 'The photo is dark',
      detail:
        'Dark areas merge into one or two near-black threads. Brighten the photo, or turn on Auto-enhance.',
      fix: { kind: 'enhance' },
      fixLabel: 'Turn on Auto-enhance',
    });
  } else if (m.brightness > 0.82) {
    add({
      code: 'too-bright',
      severity: 'warning',
      title: 'The photo is very bright',
      detail:
        'Light areas will all become white or cream. Lower the brightness a little, or turn on Auto-enhance.',
      fix: { kind: 'enhance' },
      fixLabel: 'Turn on Auto-enhance',
    });
  }
  if (m.contrast < 0.3) {
    add({
      code: 'low-contrast',
      severity: 'warning',
      title: 'The photo looks flat',
      detail:
        'Low contrast means similar threads everywhere and a washed-out result. Auto-enhance stretches the contrast.',
      fix: { kind: 'enhance' },
      fixLabel: 'Turn on Auto-enhance',
    });
  }
  if (m.clipped > 0.2) {
    add({
      code: 'clipped',
      severity: 'info',
      title: 'Large pure black or white areas',
      detail:
        'Areas with no detail will be one flat colour. That is fine for a plain background, but not for a face or a sky.',
    });
  }

  // 6. Busy detail -> confetti / tiny regions
  if (target.targetType === 'color_by_number') {
    if (m.averageRegionSize < 6) {
      add({
        code: 'too-many-regions',
        severity: m.averageRegionSize < 3 ? 'problem' : 'warning',
        title: 'Too many tiny areas to paint',
        detail:
          `Areas will average only ${m.averageRegionSize.toFixed(1)} cells, so the canvas is mostly numbers. ` +
          'Use fewer colours (8-16 is typical for paint by number) and turn on Clean up.',
        fix: { kind: 'colors', colorCount: Math.min(target.colorCount, 12) },
        fixLabel: 'Use 12 colours',
      });
    }
  } else {
    const confettiLimit = target.targetType === 'diamond' ? 0.2 : 0.12;
    if (m.confetti > confettiLimit) {
      add({
        code: 'confetti',
        severity: 'warning',
        title: 'Lots of single scattered stitches',
        detail:
          `About ${Math.round(m.confetti * 100)}% of the stitches would be lone "confetti" stitches - slow to stitch and noisy to look at. ` +
          'Clean up removes them; a simpler photo or plain background helps too.',
        fix: { kind: 'cleanup' },
        fixLabel: 'Turn on Clean up',
      });
    } else if (m.confetti > confettiLimit / 2) {
      add({
        code: 'some-confetti',
        severity: 'info',
        title: 'Some scattered stitches',
        detail: `About ${Math.round(m.confetti * 100)}% of the stitches would stand alone. Clean up will tidy them.`,
        fix: { kind: 'cleanup' },
        fixLabel: 'Turn on Clean up',
      });
    }
  }

  // 7. Small patterns
  if (target.width * target.height < 40 * 40 && isPhotoCraft) {
    add({
      code: 'small-pattern',
      severity: 'info',
      title: 'A small pattern holds little detail',
      detail:
        'Under about 40x40 stitches, photos turn into simple shapes. Logos, pets in close-up and simple scenes work best.',
    });
  }

  advice.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const score = Math.max(
    0,
    Math.min(100, 100 - advice.reduce((sum, a) => sum + SEVERITY_PENALTY[a.severity], 0)),
  );
  const verdict = score >= 85 ? 'great' : score >= 70 ? 'good' : score >= 45 ? 'fair' : 'poor';
  const top = advice.find((a) => a.severity === 'problem' || a.severity === 'warning');
  const summary =
    verdict === 'great'
      ? 'This photo should make a good pattern.'
      : verdict === 'good'
        ? `Should work well. ${top ? `Worth checking: ${lowerFirst(top.title)}.` : ''}`.trim()
        : verdict === 'fair'
          ? `This will work, with compromises: ${lowerFirst(top?.title ?? 'see below')}.`
          : `This photo is likely to stitch badly: ${lowerFirst(top?.title ?? 'see below')}.`;

  const metrics: ImageMetrics = {
    sharpness: Math.round(m.sharpness),
    brightness: round2(m.brightness),
    contrast: round2(m.contrast),
    clipped: round2(m.clipped),
    confetti: round2(m.confetti),
    colorsUsed: m.colorsUsed,
    ...(target.targetType === 'color_by_number'
      ? { averageRegionSize: round2(m.averageRegionSize) }
      : {}),
  };

  return {
    source: m.source,
    target: { type: target.targetType, ...pickSize(target), colorCount: target.colorCount },
    score,
    verdict,
    summary,
    metrics,
    faces,
    advice,
    suggested: suggestSettings(advice, target, proportionalHeight),
  };
}

function suggestSettings(
  advice: readonly ImageAdvice[],
  target: AnalyzeImageParams,
  proportionalHeight: number,
): ImageAnalysis['suggested'] {
  const suggested = {
    width: target.width,
    height: proportionalHeight,
    colorCount: target.colorCount,
    enhance: false,
    cleanup: target.targetType !== 'diamond',
  };
  for (const { fix } of advice) {
    if (!fix) continue;
    if (fix.kind === 'size') {
      // Shrinking for resolution wins over growing for faces.
      if (fix.width < suggested.width || suggested.width === target.width) {
        suggested.width = fix.width;
        suggested.height = fix.height;
      }
    } else if (fix.kind === 'colors') suggested.colorCount = fix.colorCount;
    else if (fix.kind === 'enhance') suggested.enhance = true;
    else if (fix.kind === 'cleanup') suggested.cleanup = true;
  }
  return suggested;
}

/**
 * A head-and-shoulders crop around the given faces (relative boxes), in the
 * pattern's proportions where possible. Null when the faces already fill
 * most of the photo (cropping wouldn't help).
 */
export function headAndShoulders(
  faces: readonly RelativeBox[],
  targetAspect: number,
  sourceAspect: number,
): RelativeBox | null {
  if (faces.length === 0) return null;
  const left = Math.min(...faces.map((f) => f.x));
  const top = Math.min(...faces.map((f) => f.y));
  const right = Math.max(...faces.map((f) => f.x + f.width));
  const bottom = Math.max(...faces.map((f) => f.y + f.height));
  // Detector boxes are brow-to-chin; add hair above and shoulders below.
  const faceH = bottom - top;
  let y0 = top - faceH * 0.6;
  let y1 = bottom + faceH * 0.9;
  let height = y1 - y0;
  // Width in relative units that gives the target aspect ratio in pixels.
  let width = Math.max((right - left) * 1.6, (height * targetAspect) / sourceAspect);
  height = Math.max(height, (width * sourceAspect) / targetAspect);
  width = Math.min(1, width);
  height = Math.min(1, height);
  const cx = (left + right) / 2;
  const cy = (y0 + y1) / 2;
  let x0 = Math.min(Math.max(0, cx - width / 2), 1 - width);
  y0 = Math.min(Math.max(0, cy - height / 2), 1 - height);
  y1 = y0 + height;
  x0 = Math.max(0, x0);
  if (width * height > 0.8) return null;
  return { x: round4(x0), y: round4(y0), width: round4(width), height: round4(y1 - y0) };
}

export async function analyzeImage(
  buffer: Buffer,
  target: AnalyzeImageParams,
): Promise<ImageAnalysis> {
  return adviseFromMeasurements(await measureImage(buffer, target), target);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const pickSize = ({ width, height }: AnalyzeImageParams) => ({ width, height });
