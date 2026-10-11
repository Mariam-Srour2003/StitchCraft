/**
 * A small, dependency-free port of OpenCV's Haar cascade detector
 * (`CascadeClassifier::detectMultiScale` for HAAR, non-tilted, tree-based
 * cascades), so the API can find faces in a photo with no Python service
 * and no native add-on.
 *
 * It mirrors OpenCV's approach rather than the original Viola-Jones one:
 * the *image* is resized for each scale (bilinear) and the classifier always
 * runs at its trained window size, with each window's feature values divided
 * by the window's standard deviation (lighting normalization). Results were
 * checked against cv2 on the same grayscale pixels - see the spec.
 */

/** [x, y, width, height, weight] */
type HaarRect = [number, number, number, number, number];
/** [left, right, featureIndex, threshold]; child <= 0 means leaf index -child. */
type TreeNode = [number, number, number, number];
type WeakTree = [nodes: TreeNode[], leaves: number[]];

export interface HaarCascade {
  width: number;
  height: number;
  stages: Array<[threshold: number, trees: WeakTree[]]>;
  features: HaarRect[][];
}

export interface GrayImage {
  width: number;
  height: number;
  /** One luma byte per pixel, row-major. */
  data: Uint8Array;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectOptions {
  /** Window grows by this factor per scale (OpenCV default 1.1). */
  scaleFactor?: number;
  /** A face must be found by more than this many overlapping windows (OpenCV default 3). */
  minNeighbors?: number;
  /** Smallest face to look for, in pixels of the input image. */
  minSize?: number;
}

/** Rec. 601 luma, as cv2.cvtColor(..., COLOR_RGB2GRAY) computes it. */
export function toGray(
  rgb: Uint8Array | Buffer,
  width: number,
  height: number,
  channels: number,
): GrayImage {
  const data = new Uint8Array(width * height);
  for (let i = 0, o = 0; i < data.length; i++, o += channels) {
    data[i] = Math.round(0.299 * rgb[o] + 0.587 * rgb[o + 1] + 0.114 * rgb[o + 2]);
  }
  return { width, height, data };
}

/** Bilinear resize with pixel-centre alignment (cv2.INTER_LINEAR). */
export function resizeGray(src: GrayImage, width: number, height: number): GrayImage {
  const data = new Uint8Array(width * height);
  const sx = src.width / width;
  const sy = src.height / height;
  for (let y = 0; y < height; y++) {
    let fy = (y + 0.5) * sy - 0.5;
    if (fy < 0) fy = 0;
    let y0 = Math.floor(fy);
    if (y0 > src.height - 1) y0 = src.height - 1;
    const y1 = Math.min(y0 + 1, src.height - 1);
    const wy = fy - y0;
    for (let x = 0; x < width; x++) {
      let fx = (x + 0.5) * sx - 0.5;
      if (fx < 0) fx = 0;
      let x0 = Math.floor(fx);
      if (x0 > src.width - 1) x0 = src.width - 1;
      const x1 = Math.min(x0 + 1, src.width - 1);
      const wx = fx - x0;
      const top = src.data[y0 * src.width + x0] * (1 - wx) + src.data[y0 * src.width + x1] * wx;
      const bottom = src.data[y1 * src.width + x0] * (1 - wx) + src.data[y1 * src.width + x1] * wx;
      data[y * width + x] = Math.round(top * (1 - wy) + bottom * wy);
    }
  }
  return { width, height, data };
}

/** Sum and squared-sum integral images, (w+1) x (h+1). */
function integrals(img: GrayImage): { sum: Float64Array; sq: Float64Array; stride: number } {
  const stride = img.width + 1;
  const sum = new Float64Array(stride * (img.height + 1));
  const sq = new Float64Array(stride * (img.height + 1));
  for (let y = 0; y < img.height; y++) {
    let rowSum = 0;
    let rowSq = 0;
    for (let x = 0; x < img.width; x++) {
      const v = img.data[y * img.width + x];
      rowSum += v;
      rowSq += v * v;
      const i = (y + 1) * stride + x + 1;
      sum[i] = sum[i - stride] + rowSum;
      sq[i] = sq[i - stride] + rowSq;
    }
  }
  return { sum, sq, stride };
}

function rectSum(
  table: Float64Array,
  stride: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const a = y * stride + x;
  const b = a + w;
  const c = a + h * stride;
  return table[a] - table[b] - table[c] + table[c + w];
}

/**
 * The cascade flattened into typed arrays, so the hot loop does no
 * allocation or destructuring (about 10x faster than walking the JSON).
 */
interface CompiledCascade {
  width: number;
  height: number;
  stageThreshold: Float64Array;
  /** Trees of stage s are stageStart[s] .. stageStart[s+1]-1. */
  stageStart: Int32Array;
  treeNodeStart: Int32Array;
  treeLeafStart: Int32Array;
  nodeLeft: Int32Array;
  nodeRight: Int32Array;
  nodeFeature: Int32Array;
  nodeThreshold: Float64Array;
  leaves: Float64Array;
  /** Rects of feature f are featureStart[f] .. featureStart[f+1]-1. */
  featureStart: Int32Array;
  rects: Int32Array; // x, y, w, h per rect
  rectWeight: Float64Array;
}

const compiledCache = new WeakMap<HaarCascade, CompiledCascade>();

function compile(cascade: HaarCascade): CompiledCascade {
  const cached = compiledCache.get(cascade);
  if (cached) return cached;
  const trees = cascade.stages.flatMap(([, t]) => t);
  const nodes = trees.flatMap(([n]) => n);
  const rects = cascade.features.flat();
  const compiled: CompiledCascade = {
    width: cascade.width,
    height: cascade.height,
    stageThreshold: Float64Array.from(cascade.stages.map(([t]) => t)),
    stageStart: Int32Array.from(prefix(cascade.stages.map(([, t]) => t.length))),
    treeNodeStart: Int32Array.from(prefix(trees.map(([n]) => n.length))),
    treeLeafStart: Int32Array.from(prefix(trees.map(([, l]) => l.length))),
    nodeLeft: Int32Array.from(nodes.map((n) => n[0])),
    nodeRight: Int32Array.from(nodes.map((n) => n[1])),
    nodeFeature: Int32Array.from(nodes.map((n) => n[2])),
    nodeThreshold: Float64Array.from(nodes.map((n) => n[3])),
    leaves: Float64Array.from(trees.flatMap(([, l]) => l)),
    featureStart: Int32Array.from(prefix(cascade.features.map((f) => f.length))),
    rects: Int32Array.from(rects.flatMap(([x, y, w, h]) => [x, y, w, h])),
    rectWeight: Float64Array.from(rects.map((r) => r[4])),
  };
  compiledCache.set(cascade, compiled);
  return compiled;
}

/** [3, 1, 2] -> [0, 3, 4, 6] */
function prefix(lengths: number[]): number[] {
  const out = [0];
  for (const length of lengths) out.push(out[out.length - 1] + length);
  return out;
}

/** Runs the cascade on every window of one (already resized) image. */
function scanScale(
  c: CompiledCascade,
  img: GrayImage,
  step: number,
  factor: number,
  hits: Box[],
): void {
  const { sum, sq, stride } = integrals(img);
  const winW = c.width;
  const winH = c.height;
  // OpenCV normalizes by the window's variance over the window inset by 1px.
  const normArea = (winW - 2) * (winH - 2);
  const maxX = img.width - winW;
  const maxY = img.height - winH;

  // Each rect's four integral-image corners as offsets from the window's
  // top-left, for this image's stride.
  const rectCount = c.rectWeight.length;
  const corners = new Int32Array(rectCount * 4);
  for (let r = 0; r < rectCount; r++) {
    const x = c.rects[r * 4];
    const y = c.rects[r * 4 + 1];
    const w = c.rects[r * 4 + 2];
    const h = c.rects[r * 4 + 3];
    corners[r * 4] = y * stride + x;
    corners[r * 4 + 1] = y * stride + x + w;
    corners[r * 4 + 2] = (y + h) * stride + x;
    corners[r * 4 + 3] = (y + h) * stride + x + w;
  }
  const {
    stageThreshold,
    stageStart,
    treeNodeStart,
    treeLeafStart,
    nodeLeft,
    nodeRight,
    nodeFeature,
    nodeThreshold,
    leaves,
    featureStart,
    rectWeight,
  } = c;
  const stageCount = stageThreshold.length;

  for (let y = 0; y <= maxY; y += step) {
    for (let x = 0; x <= maxX; x += step) {
      const s = rectSum(sum, stride, x + 1, y + 1, winW - 2, winH - 2);
      const s2 = rectSum(sq, stride, x + 1, y + 1, winW - 2, winH - 2);
      let nf = normArea * s2 - s * s;
      nf = nf > 0 ? Math.sqrt(nf) : 1;
      const inv = 1 / nf;
      const origin = y * stride + x;

      let passed = true;
      for (let stage = 0; stage < stageCount; stage++) {
        let stageSum = 0;
        const treeEnd = stageStart[stage + 1];
        for (let tree = stageStart[stage]; tree < treeEnd; tree++) {
          const nodeBase = treeNodeStart[tree];
          let idx = 0;
          for (;;) {
            const node = nodeBase + idx;
            const feature = nodeFeature[node];
            let value = 0;
            const rectEnd = featureStart[feature + 1];
            for (let r = featureStart[feature]; r < rectEnd; r++) {
              const k = r * 4;
              value +=
                rectWeight[r] *
                (sum[origin + corners[k]] -
                  sum[origin + corners[k + 1]] -
                  sum[origin + corners[k + 2]] +
                  sum[origin + corners[k + 3]]);
            }
            const next = value * inv < nodeThreshold[node] ? nodeLeft[node] : nodeRight[node];
            if (next <= 0) {
              stageSum += leaves[treeLeafStart[tree] - next];
              break;
            }
            idx = next;
          }
        }
        if (stageSum < stageThreshold[stage]) {
          passed = false;
          break;
        }
      }
      if (passed) {
        hits.push({
          x: Math.round(x * factor),
          y: Math.round(y * factor),
          width: Math.round(winW * factor),
          height: Math.round(winH * factor),
        });
      }
    }
  }
}

/**
 * cv2.groupRectangles: cluster boxes whose edges are all within
 * eps * (mean of the smaller sides) of each other, average each cluster,
 * drop clusters with <= minNeighbors members, then drop boxes that sit
 * inside a much better-supported bigger one.
 */
export function groupBoxes(boxes: Box[], minNeighbors: number, eps = 0.2): Box[] {
  const n = boxes.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const similar = (a: Box, b: Box) => {
    const delta = eps * (Math.min(a.width, b.width) + Math.min(a.height, b.height)) * 0.5;
    return (
      Math.abs(a.x - b.x) <= delta &&
      Math.abs(a.y - b.y) <= delta &&
      Math.abs(a.x + a.width - b.x - b.width) <= delta &&
      Math.abs(a.y + a.height - b.y - b.height) <= delta
    );
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (similar(boxes[i], boxes[j])) parent[find(i)] = find(j);
    }
  }

  const clusters = new Map<number, { x: number; y: number; w: number; h: number; count: number }>();
  boxes.forEach((box, i) => {
    const root = find(i);
    const c = clusters.get(root) ?? { x: 0, y: 0, w: 0, h: 0, count: 0 };
    c.x += box.x;
    c.y += box.y;
    c.w += box.width;
    c.h += box.height;
    c.count++;
    clusters.set(root, c);
  });

  const averaged = [...clusters.values()]
    .filter((c) => c.count > minNeighbors)
    .map((c) => ({
      box: {
        x: Math.round(c.x / c.count),
        y: Math.round(c.y / c.count),
        width: Math.round(c.w / c.count),
        height: Math.round(c.h / c.count),
      },
      count: c.count,
    }));

  return averaged
    .filter(
      ({ box, count }) =>
        !averaged.some((other) => {
          if (other.box === box || other.count < count) return false;
          const dx = Math.round(other.box.width * eps);
          const dy = Math.round(other.box.height * eps);
          return (
            (other.count > 3 || count < 3) &&
            box.x >= other.box.x - dx &&
            box.y >= other.box.y - dy &&
            box.x + box.width <= other.box.x + other.box.width + dx &&
            box.y + box.height <= other.box.y + other.box.height + dy &&
            (other.box.width !== box.width || other.box.height !== box.height)
          );
        }),
    )
    .map(({ box }) => box);
}

/** Finds faces (or whatever the cascade was trained on) in a grayscale image. */
export function detectMultiScale(
  cascade: HaarCascade,
  image: GrayImage,
  options: DetectOptions = {},
): Box[] {
  const { scaleFactor = 1.1, minNeighbors = 3, minSize = 0 } = options;
  const compiled = compile(cascade);
  const hits: Box[] = [];
  for (let factor = 1; ; factor *= scaleFactor) {
    const winW = Math.round(cascade.width * factor);
    const winH = Math.round(cascade.height * factor);
    const scaledW = Math.round(image.width / factor);
    const scaledH = Math.round(image.height / factor);
    if (scaledW < cascade.width || scaledH < cascade.height) break;
    if (winW < minSize || winH < minSize) continue;
    const scaled = factor === 1 ? image : resizeGray(image, scaledW, scaledH);
    scanScale(compiled, scaled, factor > 2 ? 1 : 2, factor, hits);
  }
  return groupBoxes(hits, minNeighbors);
}
