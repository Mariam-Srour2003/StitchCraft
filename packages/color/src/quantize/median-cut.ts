import type { Lab, Rgb } from '@stitchcraft/types';
import { labToSrgb, srgbToLab } from '../space/srgb-lab';

interface Box {
  points: Lab[];
}

/** Below this Lab-axis range, a box's points are treated as identical (avoids splitting a uniform box into meaningless duplicate boxes). */
const MIN_SPLITTABLE_RANGE = 1e-6;

/**
 * Median-cut color quantization in CIELAB space: repeatedly splits the box
 * with the largest range along its widest axis at the median, until there
 * are `colorCount` boxes, then returns each box's mean color. Deterministic
 * (no randomness), which is required for a "convert this image the same way
 * twice" guarantee.
 */
export function medianCutQuantize(pixels: readonly Rgb[], colorCount: number): Rgb[] {
  if (colorCount < 1) throw new Error('colorCount must be >= 1');
  if (pixels.length === 0) return [];

  const labPoints = pixels.map(srgbToLab);
  let boxes: Box[] = [{ points: labPoints }];

  while (boxes.length < colorCount) {
    const splittable = boxes
      .map((box, index) => ({ box, index, range: widestAxisRange(box) }))
      .filter((entry) => entry.box.points.length > 1 && entry.range.size > MIN_SPLITTABLE_RANGE)
      .sort((a, b) => b.range.size - a.range.size)[0];

    if (!splittable) break; // every remaining box is internally uniform (or a single point) - nothing left worth splitting

    const { box, index, range } = splittable;
    const sorted = [...box.points].sort((a, b) => a[range.axis] - b[range.axis]);
    const splitIndex = nearestValueBoundary(sorted, range.axis);

    const next = [...boxes];
    next.splice(
      index,
      1,
      { points: sorted.slice(0, splitIndex) },
      { points: sorted.slice(splitIndex) },
    );
    boxes = next;
  }

  return boxes.map((box) => labToSrgb(meanLab(box.points)));
}

/**
 * Splitting strictly at the point-count median can land inside a run of
 * equal values, cutting one perceptual color-cluster across both child
 * boxes (most visibly when several equal-sized clusters are present - e.g.
 * three colors with exactly the same pixel count each). Instead, pick the
 * boundary where the axis value actually changes that's closest to the
 * count median, so no box is split down the middle of an identical run.
 * `sorted` is already sorted ascending by `axis`, and is guaranteed to have
 * at least one such boundary since the caller only splits boxes with
 * non-zero range on this axis.
 */
function nearestValueBoundary(sorted: readonly Lab[], axis: keyof Lab): number {
  const idealMid = Math.ceil(sorted.length / 2);
  let bestIndex = idealMid;
  let bestDistance = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][axis] !== sorted[i - 1][axis]) {
      const distance = Math.abs(i - idealMid);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
  }
  return bestIndex;
}

function widestAxisRange(box: Box): { axis: keyof Lab; size: number } {
  const axes: Array<keyof Lab> = ['l', 'a', 'b'];
  let widest: { axis: keyof Lab; size: number } = { axis: 'l', size: -1 };
  for (const axis of axes) {
    const values = box.points.map((p) => p[axis]);
    const size = Math.max(...values) - Math.min(...values);
    if (size > widest.size) widest = { axis, size };
  }
  return widest;
}

function meanLab(points: readonly Lab[]): Lab {
  const sum = points.reduce((acc, p) => ({ l: acc.l + p.l, a: acc.a + p.a, b: acc.b + p.b }), {
    l: 0,
    a: 0,
    b: 0,
  });
  return { l: sum.l / points.length, a: sum.a / points.length, b: sum.b / points.length };
}
