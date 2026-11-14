/**
 * Connected-region analysis for the paint-by-number view: every 4-connected
 * run of same-colored cells is one region to paint, numbered once (like a
 * real paint-by-number canvas) instead of once per cell.
 */

export interface Region {
  id: number;
  paletteIndex: number;
  size: number;
  /** The cell deepest inside the region - where its number is printed. */
  labelX: number;
  labelY: number;
}

export interface RegionMap {
  width: number;
  height: number;
  /** Region id per cell (row-major), or -1 for an empty cell. */
  ids: Int32Array;
  regions: Region[];
}

export function computeRegions(
  grid: readonly (Int16Array | readonly number[])[],
  width: number,
  height: number,
): RegionMap {
  const ids = new Int32Array(width * height).fill(-1);
  const regions: Region[] = [];
  const stack: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      const value = grid[y][x];
      if (value < 0 || ids[start] !== -1) continue;

      const id = regions.length;
      let size = 0;
      ids[start] = id;
      stack.push(start);
      while (stack.length) {
        const key = stack.pop() as number;
        size++;
        const cx = key % width;
        const cy = (key - cx) / width;
        const visit = (nx: number, ny: number) => {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
          const nKey = ny * width + nx;
          if (ids[nKey] !== -1 || grid[ny][nx] !== value) return;
          ids[nKey] = id;
          stack.push(nKey);
        };
        visit(cx + 1, cy);
        visit(cx - 1, cy);
        visit(cx, cy + 1);
        visit(cx, cy - 1);
      }
      regions.push({ id, paletteIndex: value, size, labelX: x, labelY: y });
    }
  }

  placeLabels(ids, width, height, regions);
  return { width, height, ids, regions };
}

/**
 * Multi-source BFS from every region's boundary cells inward; the cell with
 * the largest distance in each region is the most legible place for its
 * number (away from the outline, never in a thin neck).
 */
function placeLabels(ids: Int32Array, width: number, height: number, regions: Region[]): void {
  const dist = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const sameRegion = (key: number, nx: number, ny: number) =>
    nx >= 0 && ny >= 0 && nx < width && ny < height && ids[ny * width + nx] === ids[key];

  for (let key = 0; key < ids.length; key++) {
    if (ids[key] < 0) continue;
    const x = key % width;
    const y = (key - x) / width;
    const interior =
      sameRegion(key, x + 1, y) &&
      sameRegion(key, x - 1, y) &&
      sameRegion(key, x, y + 1) &&
      sameRegion(key, x, y - 1);
    if (!interior) {
      dist[key] = 0;
      queue[tail++] = key;
    }
  }

  while (head < tail) {
    const key = queue[head++];
    const x = key % width;
    const y = (key - x) / width;
    const neighbours: [number, number][] = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (!sameRegion(key, nx, ny)) continue;
      const nKey = ny * width + nx;
      if (dist[nKey] !== -1) continue;
      dist[nKey] = dist[key] + 1;
      queue[tail++] = nKey;
    }
  }

  const best = new Int32Array(regions.length).fill(-1);
  for (let key = 0; key < ids.length; key++) {
    const id = ids[key];
    if (id < 0 || dist[key] <= best[id]) continue;
    best[id] = dist[key];
    regions[id].labelX = key % width;
    regions[id].labelY = Math.floor(key / width);
  }
}

/** True when the edge between two cells is a region boundary (or the cell meets the grid edge). */
export function isRegionEdge(
  map: RegionMap,
  x: number,
  y: number,
  nx: number,
  ny: number,
): boolean {
  const id = map.ids[y * map.width + x];
  if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return id >= 0;
  return map.ids[ny * map.width + nx] !== id;
}
