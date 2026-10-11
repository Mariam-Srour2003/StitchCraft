import { readFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

import type { AnalyzeImageParams } from '@stitchcraft/types';

import type { ImageMeasurements } from './analyze-image';
import { adviseFromMeasurements, analyzeImage, headAndShoulders } from './analyze-image';

const target = (over: Partial<AnalyzeImageParams> = {}): AnalyzeImageParams => ({
  targetType: 'cross_stitch',
  width: 80,
  height: 80,
  colorCount: 24,
  ...over,
});

/** A photo that should pass every rule. */
const goodPhoto = (over: Partial<ImageMeasurements> = {}): ImageMeasurements => ({
  source: { width: 800, height: 800 },
  sharpness: 500,
  brightness: 0.5,
  contrast: 0.8,
  clipped: 0.01,
  confetti: 0.02,
  colorsUsed: 24,
  averageRegionSize: 20,
  faces: [],
  ...over,
});

const codes = (m: ImageMeasurements, t = target()) =>
  adviseFromMeasurements(m, t).advice.map((a) => a.code);

describe('adviseFromMeasurements', () => {
  it('gives a clean bill of health to a good photo', () => {
    const result = adviseFromMeasurements(goodPhoto(), target());
    expect(result.verdict).toBe('great');
    expect(result.score).toBe(100);
    expect(result.advice).toEqual([]);
    expect(result.summary).toMatch(/good pattern/);
  });

  describe('faces', () => {
    const face = (height: number) => ({ x: 0.45, y: 0.4, width: height, height });

    it('flags a far-away face as unrecognisable and offers a crop to it', () => {
      // 5% of an 80-stitch-tall pattern = 4 stitches
      const result = adviseFromMeasurements(goodPhoto({ faces: [face(0.05)] }), target());
      expect(result.faces[0].stitchHeight).toBe(4);
      const advice = result.advice[0];
      expect(advice).toMatchObject({ code: 'face-too-small', severity: 'problem' });
      expect(advice.fix?.kind).toBe('crop');
      expect(result.verdict).not.toBe('great');
    });

    it('grades by stitch height: simplified, recognisable, good', () => {
      expect(codes(goodPhoto({ faces: [face(0.15)] }))).toContain('face-small'); // 12
      expect(codes(goodPhoto({ faces: [face(0.3)] }))).toContain('face-ok'); // 24
      expect(codes(goodPhoto({ faces: [face(0.5)] }))).toContain('face-good'); // 40
    });

    it('the same photo is fine at a bigger pattern size', () => {
      const small = codes(goodPhoto({ faces: [face(0.1)] }), target({ width: 80, height: 80 }));
      const big = codes(goodPhoto({ faces: [face(0.1)] }), target({ width: 300, height: 300 }));
      expect(small).toContain('face-too-small');
      expect(big).toContain('face-good');
    });

    it('notes uneven faces in a group photo', () => {
      expect(codes(goodPhoto({ faces: [face(0.4), { ...face(0.05), x: 0.1 }] }))).toContain(
        'faces-uneven',
      );
    });

    it('suggests more colours for skin', () => {
      const result = adviseFromMeasurements(
        goodPhoto({ faces: [face(0.5)] }),
        target({ colorCount: 10 }),
      );
      expect(result.advice.map((a) => a.code)).toContain('skin-needs-colors');
      expect(result.suggested.colorCount).toBe(24);
    });
  });

  it('warns about stretching and suggests proportional dimensions', () => {
    const result = adviseFromMeasurements(
      goodPhoto({ source: { width: 1200, height: 800 } }),
      target({ width: 90, height: 90 }),
    );
    expect(result.advice[0]).toMatchObject({ code: 'aspect-mismatch', severity: 'problem' });
    expect(result.advice[0].fix).toEqual({ kind: 'size', width: 90, height: 60 });
    expect(result.suggested).toMatchObject({ width: 90, height: 60 });
  });

  it('flags a photo smaller than the pattern and suggests shrinking', () => {
    const result = adviseFromMeasurements(
      goodPhoto({ source: { width: 50, height: 50 } }),
      target({ width: 100, height: 100 }),
    );
    expect(result.advice[0].code).toBe('low-resolution');
    expect(result.suggested).toMatchObject({ width: 50, height: 50 });
  });

  it('flags blur, darkness and flatness, and suggests auto-enhance', () => {
    expect(codes(goodPhoto({ sharpness: 10 }))).toContain('blurry');
    const dark = adviseFromMeasurements(goodPhoto({ brightness: 0.1 }), target());
    expect(dark.advice.map((a) => a.code)).toContain('too-dark');
    expect(dark.suggested.enhance).toBe(true);
    expect(codes(goodPhoto({ brightness: 0.9 }))).toContain('too-bright');
    expect(codes(goodPhoto({ contrast: 0.2 }))).toContain('low-contrast');
  });

  it('judges confetti by craft: diamond painting tolerates more', () => {
    expect(codes(goodPhoto({ confetti: 0.15 }))).toContain('confetti');
    expect(codes(goodPhoto({ confetti: 0.15 }), target({ targetType: 'diamond' }))).toContain(
      'some-confetti',
    );
  });

  it('for paint by number, warns about tiny regions instead of confetti', () => {
    const pbn = target({ targetType: 'color_by_number', colorCount: 30 });
    const result = adviseFromMeasurements(goodPhoto({ averageRegionSize: 2, confetti: 0.3 }), pbn);
    expect(result.advice.map((a) => a.code)).toEqual(['too-many-regions']);
    expect(result.suggested.colorCount).toBe(12);
    expect(result.metrics.averageRegionSize).toBe(2);
  });

  it('orders advice most serious first and lowers the score accordingly', () => {
    const result = adviseFromMeasurements(
      goodPhoto({ confetti: 0.08, sharpness: 10, source: { width: 1600, height: 800 } }),
      target(),
    );
    const order = { problem: 0, warning: 1, info: 2, good: 3 };
    const severities = result.advice.map((a) => order[a.severity]);
    expect(severities).toEqual([...severities].sort());
    expect(result.verdict).toBe('poor');
  });
});

describe('headAndShoulders', () => {
  it('frames the face with room for hair and shoulders, inside the photo', () => {
    const crop = headAndShoulders([{ x: 0.45, y: 0.3, width: 0.1, height: 0.1 }], 1, 1);
    expect(crop).not.toBeNull();
    if (!crop) return;
    expect(crop.y).toBeLessThan(0.3);
    expect(crop.y + crop.height).toBeGreaterThan(0.4);
    expect(crop.x).toBeLessThan(0.45);
    expect(crop.x + crop.width).toBeGreaterThan(0.55);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1.0001);
    expect(crop.width / crop.height).toBeCloseTo(1, 1); // square pattern, square photo
  });

  it('returns null when the face already fills the photo', () => {
    expect(headAndShoulders([{ x: 0.1, y: 0.1, width: 0.8, height: 0.7 }], 1, 1)).toBeNull();
  });
});

describe('analyzeImage (real photo)', () => {
  const photo = readFileSync(join(__dirname, 'faces', '__fixtures__', 'astronaut-256.png'));

  it('finds the face and says how big it will be in stitches', async () => {
    const result = await analyzeImage(photo, target({ width: 60, height: 60 }));
    expect(result.source).toEqual({ width: 256, height: 256 });
    expect(result.faces.length).toBeGreaterThanOrEqual(1);
    // face box is 49/256 of the height -> ~11 stitches at 60 tall
    expect(result.faces.map((f) => f.stitchHeight)).toContain(11);
    expect(result.advice.some((a) => a.code.startsWith('face-'))).toBe(true);
    expect(result.metrics.colorsUsed).toBeGreaterThan(1);
  });

  it('rejects data that is not an image', async () => {
    await expect(analyzeImage(Buffer.from('not an image'), target())).rejects.toThrow();
  });

  it('handles a tiny image without faces', async () => {
    const tiny = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .png()
      .toBuffer();
    const result = await analyzeImage(tiny, target({ width: 40, height: 40 }));
    expect(result.faces).toEqual([]);
    expect(result.advice[0].code).toBe('low-resolution');
  });
});
