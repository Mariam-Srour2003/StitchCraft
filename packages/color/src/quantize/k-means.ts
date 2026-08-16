import { Lab, Rgb } from '@stitchcraft/types';
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
    const clusters: Lab[][] = Array.from({ length: k }, () => []);
    for (const point of labPoints) {
      clusters[nearestCentroidIndex(point, centroids)].push(point);
    }

    const next = clusters.map((cluster, i) => (cluster.length > 0 ? meanLab(cluster) : centroids[i]));

    const maxShift = Math.max(...next.map((c, i) => labDistance(c, centroids[i])));
    centroids = next;
    if (maxShift < tolerance) break;
  }

  return centroids.map(labToSrgb);
}

function seedCentroids(points: readonly Lab[], k: number): Lab[] {
  const sorted = [...points].sort((a, b) => a.l - b.l || a.a - b.a || a.b - b.b);
  const step = sorted.length / k;
  return Array.from({ length: k }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(i * step))]);
}

function nearestCentroidIndex(point: Lab, centroids: readonly Lab[]): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  centroids.forEach((centroid, index) => {
    const distance = labDistance(point, centroid);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function labDistance(a: Lab, b: Lab): number {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

function meanLab(points: readonly Lab[]): Lab {
  const sum = points.reduce(
    (acc, p) => ({ l: acc.l + p.l, a: acc.a + p.a, b: acc.b + p.b }),
    { l: 0, a: 0, b: 0 },
  );
  return { l: sum.l / points.length, a: sum.a / points.length, b: sum.b / points.length };
}
