import type { Lab, Rgb } from '@hobbygrid/types';

/** A colour from an image with how many pixels it stands for. */
export interface WeightedLab {
  lab: Lab;
  weight: number;
}

/**
 * Summarises pixels as weighted colours: pixels are grouped by the top
 * `bits` bits of each RGB channel, and each group is represented by its
 * members' mean Lab and their count. Choosing a palette then costs the same
 * for a 500x500 photo as for a 50x50 one. With the default 5 bits (at most
 * 32,768 groups) a group's members differ by at most 7 levels per channel,
 * well under a visible difference once matched to thread.
 */
export function labHistogram(
  pixels: readonly Rgb[],
  toLab: (rgb: Rgb) => Lab,
  bits = 5,
): WeightedLab[] {
  const drop = 8 - bits;
  const sums = new Map<number, { l: number; a: number; b: number; n: number }>();
  const labCache = new Map<number, Lab>();
  for (const p of pixels) {
    const exact = (p.r << 16) | (p.g << 8) | p.b;
    let lab = labCache.get(exact);
    if (!lab) {
      lab = toLab(p);
      labCache.set(exact, lab);
    }
    const bin = ((p.r >> drop) << (2 * bits)) | ((p.g >> drop) << bits) | (p.b >> drop);
    const s = sums.get(bin);
    if (s) {
      s.l += lab.l;
      s.a += lab.a;
      s.b += lab.b;
      s.n++;
    } else {
      sums.set(bin, { l: lab.l, a: lab.a, b: lab.b, n: 1 });
    }
  }
  // Map iteration order is insertion order, so the result is deterministic.
  return [...sums.values()].map((s) => ({
    lab: { l: s.l / s.n, a: s.a / s.n, b: s.b / s.n },
    weight: s.n,
  }));
}

/**
 * Tops a palette up to `target` colours from a catalogue (e.g. the DMC
 * threads), one colour at a time, always adding the candidate that most
 * reduces the image's total colour error.
 *
 * Why: a conversion picks colours with k-means and then snaps each to the
 * nearest real thread. Two centres often snap to the same thread, so asking
 * for 30 colours delivered about 22. This fills those gaps with the threads
 * that help the picture most, instead of silently returning fewer.
 *
 * Error is plain Lab distance weighted by pixel count - close enough to
 * CIEDE2000 for ranking which thread helps most, and fast enough to try every
 * catalogue colour. Stops early once no candidate lowers the image's
 * average error by at least `minGainPerPixel` (in ΔE): without that floor, a
 * flat six-colour logo collected a thread for every anti-aliased edge shade.
 * The default 0.01 was picked on the conversion benchmark: photos still get
 * every colour asked for, at no loss of accuracy, while the logo went from 29
 * threads to 21. Deterministic: ties go to the earlier catalogue entry.
 * `chosen` is returned first, unchanged.
 */
export function fillPalette<T extends { lab: Lab }>(
  samples: readonly WeightedLab[],
  chosen: readonly T[],
  catalogue: readonly T[],
  target: number,
  minGainPerPixel = 0.01,
): T[] {
  const result = [...chosen];
  if (result.length >= target || samples.length === 0) return result;

  const n = samples.length;
  const sl = new Float64Array(n);
  const sa = new Float64Array(n);
  const sb = new Float64Array(n);
  const w = new Float64Array(n);
  samples.forEach((s, i) => {
    sl[i] = s.lab.l;
    sa[i] = s.lab.a;
    sb[i] = s.lab.b;
    w[i] = s.weight;
  });

  // Distance from each sample to its nearest colour so far.
  const best = new Float64Array(n).fill(Infinity);
  const tighten = (lab: Lab) => {
    for (let i = 0; i < n; i++) {
      const dl = sl[i] - lab.l;
      const da = sa[i] - lab.a;
      const db = sb[i] - lab.b;
      const d = Math.sqrt(dl * dl + da * da + db * db);
      if (d < best[i]) best[i] = d;
    }
  };
  result.forEach((c) => tighten(c.lab));

  let totalWeight = 0;
  for (let i = 0; i < n; i++) totalWeight += w[i];
  const minGain = Math.max(1e-9, totalWeight * minGainPerPixel);

  const used = new Set<T>(result);
  while (result.length < target) {
    let bestCandidate: T | undefined;
    let bestGain = minGain;
    for (const candidate of catalogue) {
      if (used.has(candidate)) continue;
      const { l, a, b } = candidate.lab;
      let gain = 0;
      for (let i = 0; i < n; i++) {
        const current = best[i];
        if (current === 0) continue;
        const dl = sl[i] - l;
        const da = sa[i] - a;
        const db = sb[i] - b;
        // Squared check first: most candidates are far from most samples.
        const d2 = dl * dl + da * da + db * db;
        if (d2 >= current * current) continue;
        gain += w[i] * (current - Math.sqrt(d2));
      }
      if (gain > bestGain) {
        bestGain = gain;
        bestCandidate = candidate;
      }
    }
    if (!bestCandidate) break;
    result.push(bestCandidate);
    used.add(bestCandidate);
    tighten(bestCandidate.lab);
  }
  return result;
}
