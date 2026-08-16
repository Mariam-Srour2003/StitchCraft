import { Lab, Rgb } from '@stitchcraft/types';
import { labToSrgb, srgbToLab } from '../space/srgb-lab';

interface Box {
  points: Lab[];
}

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
      .filter((entry) => entry.box.points.length > 1)
      .sort((a, b) => b.range.size - a.range.size)[0];

    if (!splittable) break; // no box can be split further

    const { box, index, range } = splittable;
    const sorted = [...box.points].sort((a, b) => a[range.axis] - b[range.axis]);
    const mid = Math.ceil(sorted.length / 2);

    const next = [...boxes];
    next.splice(index, 1, { points: sorted.slice(0, mid) }, { points: sorted.slice(mid) });
    boxes = next;
  }

  return boxes.map((box) => labToSrgb(meanLab(box.points)));
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
  const sum = points.reduce(
    (acc, p) => ({ l: acc.l + p.l, a: acc.a + p.a, b: acc.b + p.b }),
    { l: 0, a: 0, b: 0 },
  );
  return { l: sum.l / points.length, a: sum.a / points.length, b: sum.b / points.length };
}
