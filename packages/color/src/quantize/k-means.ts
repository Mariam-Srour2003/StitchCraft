import type { Lab, Rgb } from '@stitchcraft/types';

import { labToSrgb, srgbToLab } from '../space/srgb-lab';

export interface KMeansOptions {
  maxIterations?: number;
  /** Convergence threshold: stop early once no centroid moves more than this (in Lab units). */
  tolerance?: number;
}

/**
 * K-means color quantization in CIELAB space (Euclidean distance - Lab is
 * built to be roughly perceptually uniform, which is why quantization
 * happens here rather than in raw sRGB). Deterministic: centroids are
 * seeded from evenly-spaced samples of the sorted input rather than random
 * picks, so the same image always quantizes to the same palette.
 */
export function kMeansQuantize(
  pixels: readonly Rgb[],
  colorCount: number,
  options: KMeansOptions = {},
): Rgb[] {
  if (colorCount < 1) throw new Error('colorCount must be >= 1');
  if (pixels.length === 0) return [];

  const { maxIterations = 20, tolerance = 0.1 } = options;
  const labPoints = pixels.map(srgbToLab);
  const k = Math.min(colorCount, labPoints.length);

  let centroids = seedCentroids(labPoints, k);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Running sums per cluster instead of collecting points: same means,
    // no per-iteration allocation.
    const sums = new Float64Array(k * 3);
    const counts = new Int32Array(k);
    for (const point of labPoints) {
      const c = nearestCentroidIndex(point, centroids);
      sums[c * 3] += point.l;
      sums[c * 3 + 1] += point.a;
      sums[c * 3 + 2] += point.b;
      counts[c]++;
    }

    const next = centroids.map((centroid, i) =>
      counts[i] > 0
        ? {
            l: sums[i * 3] / counts[i],
            a: sums[i * 3 + 1] / counts[i],
            b: sums[i * 3 + 2] / counts[i],
          }
        : centroid,
    );

    const maxShift = Math.max(...next.map((c, i) => labDistance(c, centroids[i])));
    centroids = next;
    if (maxShift < tolerance) break;
  }

  // Centroids can converge on (near-)identical points - e.g. every seed
  // starts at the same spot when the input has fewer distinct colors than
  // requested, and empty clusters simply keep their frozen starting
  // position. Collapse those rather than returning duplicate colors.
  return dedupeByLabDistance(centroids).map(labToSrgb);
}

const DEDUPE_DISTANCE = 1e-6;

function dedupeByLabDistance(points: readonly Lab[]): Lab[] {
  const deduped: Lab[] = [];
  for (const point of points) {
    if (!deduped.some((existing) => labDistance(existing, point) < DEDUPE_DISTANCE)) {
      deduped.push(point);
    }
  }
  return deduped;
}

function seedCentroids(points: readonly Lab[], k: number): Lab[] {
  const sorted = [...points].sort((a, b) => a.l - b.l || a.a - b.a || a.b - b.b);
  const step = sorted.length / k;
  return Array.from(
    { length: k },
    (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(i * step))],
  );
}

function nearestCentroidIndex(point: Lab, centroids: readonly Lab[]): number {
  // Squared distance has the same argmin as distance, without the sqrt.
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < centroids.length; index++) {
    const c = centroids[index];
    const dl = point.l - c.l;
    const da = point.a - c.a;
    const db = point.b - c.b;
    const distance = dl * dl + da * da + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function labDistance(a: Lab, b: Lab): number {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}
