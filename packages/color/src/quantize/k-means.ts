import type { Lab, Rgb } from '@stitchcraft/types';

import { labHistogram, type WeightedLab } from '../palette/fill-palette';
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
 *
 * Clusters the image's colour histogram (labHistogram, each group weighted
 * by its pixel count) rather than every pixel, so pixels of the same colour
 * are only visited once per iteration.
 */
/**
 * Histogram precision for clustering. Measured on the conversion benchmark
 * (photos, 30 colours; 500x334 at 100 colours for time): 5 bits made k-means
 * 12x faster but colour error 2% worse; 7 bits is 4x faster (2.4 s -> 0.6 s)
 * and within 1% of clustering every pixel.
 */
const HISTOGRAM_BITS = 7;

export function kMeansQuantize(
  pixels: readonly Rgb[],
  colorCount: number,
  options: KMeansOptions = {},
): Rgb[] {
  if (colorCount < 1) throw new Error('colorCount must be >= 1');
  if (pixels.length === 0) return [];

  const { maxIterations = 20, tolerance = 0.1 } = options;
  const points = labHistogram(pixels, srgbToLab, HISTOGRAM_BITS);
  const k = Math.min(colorCount, points.length);

  let centroids = seedCentroids(points, k);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Running weighted sums per cluster: same means as averaging every
    // pixel, without visiting every pixel.
    const sums = new Float64Array(k * 3);
    const weights = new Float64Array(k);
    for (const { lab, weight } of points) {
      const c = nearestCentroidIndex(lab, centroids);
      sums[c * 3] += lab.l * weight;
      sums[c * 3 + 1] += lab.a * weight;
      sums[c * 3 + 2] += lab.b * weight;
      weights[c] += weight;
    }

    const next = centroids.map((centroid, i) =>
      weights[i] > 0
        ? {
            l: sums[i * 3] / weights[i],
            a: sums[i * 3 + 1] / weights[i],
            b: sums[i * 3 + 2] / weights[i],
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

/**
 * Evenly spaced picks through the colours sorted by lightness, spaced by
 * pixel count rather than by histogram entry, so a colour covering half the
 * image gets about half the starting centres - as seeding from every pixel
 * did.
 */
function seedCentroids(points: readonly WeightedLab[], k: number): Lab[] {
  const sorted = [...points].sort(
    (p, q) => p.lab.l - q.lab.l || p.lab.a - q.lab.a || p.lab.b - q.lab.b,
  );
  const total = sorted.reduce((sum, p) => sum + p.weight, 0);
  const seeds: Lab[] = [];
  let cumulative = 0;
  let next = 0;
  for (const point of sorted) {
    cumulative += point.weight;
    while (next < k && (next * total) / k < cumulative) {
      seeds.push(point.lab);
      next++;
    }
  }
  while (seeds.length < k) seeds.push(sorted[sorted.length - 1].lab);
  return seeds;
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
