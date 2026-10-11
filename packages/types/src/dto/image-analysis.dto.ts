import type { PatternType } from '../models/pattern.model';

/** How much one finding matters for the finished piece. */
export type AdviceSeverity = 'good' | 'info' | 'warning' | 'problem';

/** A box as fractions (0..1) of the photo's width and height. */
export interface RelativeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A one-click change the converter can apply for a finding. */
export type AdviceFix =
  | { kind: 'size'; width: number; height: number }
  | { kind: 'colors'; colorCount: number }
  | { kind: 'enhance' }
  | { kind: 'cleanup' }
  | { kind: 'crop'; box: RelativeBox };

export interface ImageAdvice {
  /** Stable machine-readable id, e.g. 'face-too-small'. */
  code: string;
  severity: AdviceSeverity;
  title: string;
  detail: string;
  fix?: AdviceFix;
  /** Button text for `fix`, e.g. "Crop to the face". */
  fixLabel?: string;
}

export interface DetectedFace {
  box: RelativeBox;
  /** How many stitches tall the face will be at the requested pattern size. */
  stitchHeight: number;
}

export interface ImageMetrics {
  /** Edge strength at stitch scale; higher is crisper. */
  sharpness: number;
  /** Mean luminance, 0 (black) to 1 (white). */
  brightness: number;
  /** Spread between the 1st and 99th luminance percentile, 0..1. */
  contrast: number;
  /** Share of pixels that are pure black or pure white. */
  clipped: number;
  /** Share of stitches that would be lone "confetti" stitches at this size. */
  confetti: number;
  /** Thread colours the quantized result actually uses. */
  colorsUsed: number;
  /** Paint-by-number only: average cells per paintable region. */
  averageRegionSize?: number;
}

export interface ImageAnalysis {
  source: { width: number; height: number };
  target: { type: PatternType; width: number; height: number; colorCount: number };
  /** 0..100; a quick read of how well this photo will turn into a pattern. */
  score: number;
  verdict: 'great' | 'good' | 'fair' | 'poor';
  summary: string;
  metrics: ImageMetrics;
  faces: DetectedFace[];
  /** Most important first. */
  advice: ImageAdvice[];
  /** Every fix above applied together, ready for the converter's form. */
  suggested: {
    width: number;
    height: number;
    colorCount: number;
    enhance: boolean;
    cleanup: boolean;
  };
}

export interface AnalyzeImageParams {
  targetType: PatternType;
  width: number;
  height: number;
  colorCount: number;
}
