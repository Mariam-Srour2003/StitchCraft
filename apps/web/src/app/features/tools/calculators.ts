import { drillBagsNeeded, skeinsNeeded, stitchesPerSkein } from '@stitchcraft/color';

const CM_PER_INCH = 2.54;

export const COMMON_COUNTS = [11, 14, 16, 18, 22, 28] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface FabricSize {
  designWidthIn: number;
  designHeightIn: number;
  designWidthCm: number;
  designHeightCm: number;
  /** Fabric to cut, design plus margin on every side. */
  cutWidthIn: number;
  cutHeightIn: number;
  cutWidthCm: number;
  cutHeightCm: number;
}

/**
 * Finished design size and fabric to cut. `overTwo` is for evenweave/linen
 * stitched over two threads, which halves the effective count.
 */
export function fabricSize(
  widthStitches: number,
  heightStitches: number,
  count: number,
  marginIn: number,
  overTwo = false,
): FabricSize {
  const effective = overTwo ? count / 2 : count;
  const w = widthStitches / effective;
  const h = heightStitches / effective;
  const cw = w + marginIn * 2;
  const ch = h + marginIn * 2;
  return {
    designWidthIn: round1(w),
    designHeightIn: round1(h),
    designWidthCm: round1(w * CM_PER_INCH),
    designHeightCm: round1(h * CM_PER_INCH),
    cutWidthIn: round1(cw),
    cutHeightIn: round1(ch),
    cutWidthCm: round1(cw * CM_PER_INCH),
    cutHeightCm: round1(ch * CM_PER_INCH),
  };
}

/** How many stitches fit a target physical size - for planning a design to fit a frame. */
export function stitchesForSize(sizeIn: number, count: number): number {
  return Math.max(0, Math.floor(sizeIn * count));
}

export function threadEstimate(stitches: number, count: number, strands?: number) {
  return {
    perSkein: stitchesPerSkein(count, strands),
    skeins: skeinsNeeded(stitches, count, strands),
  };
}

export function drillEstimate(widthDrills: number, heightDrills: number, drillMm: number) {
  const drills = widthDrills * heightDrills;
  return {
    drills,
    bags: drillBagsNeeded(drills),
    widthCm: round1((widthDrills * drillMm) / 10),
    heightCm: round1((heightDrills * drillMm) / 10),
  };
}

export function timeEstimate(stitches: number, stitchesPerHour: number, hoursPerDay: number) {
  if (stitchesPerHour <= 0 || stitches <= 0) return { hours: 0, days: 0 };
  const hours = stitches / stitchesPerHour;
  return {
    hours: round1(hours),
    days: hoursPerDay > 0 ? Math.ceil(hours / hoursPerDay) : 0,
  };
}
