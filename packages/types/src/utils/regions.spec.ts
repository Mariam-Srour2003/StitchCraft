import { computeRegions, isRegionEdge } from './regions';

const E = -1;
const grid = (rows: number[][]) => rows.map((r) => Int16Array.from(r));

describe('computeRegions', () => {
  it('splits same-color cells that only touch diagonally into separate regions', () => {
    const map = computeRegions(
      grid([
        [0, 1],
        [1, 0],
      ]),
      2,
      2,
    );
    expect(map.regions).toHaveLength(4);
  });

  it('merges a 4-connected same-color area into one region with its size', () => {
    const map = computeRegions(
      grid([
        [0, 0, 1],
        [0, 1, 1],
      ]),
      3,
      2,
    );
    expect(map.regions).toHaveLength(2);
    expect(map.regions.map((r) => r.size).sort()).toEqual([3, 3]);
  });

  it('ignores empty cells', () => {
    const map = computeRegions(grid([[E, 0, E]]), 3, 1);
    expect(map.regions).toHaveLength(1);
    expect(map.ids[0]).toBe(-1);
  });

  it('places the label at the deepest cell of the region', () => {
    const map = computeRegions(grid(Array.from({ length: 5 }, () => [0, 0, 0, 0, 0])), 5, 5);
    expect(map.regions[0]).toMatchObject({ labelX: 2, labelY: 2 });
  });

  it('keeps every label inside its own region', () => {
    const g = grid([
      [0, 0, 0, 1],
      [0, 1, 1, 1],
      [0, 1, 2, 2],
    ]);
    const map = computeRegions(g, 4, 3);
    for (const r of map.regions) expect(g[r.labelY][r.labelX]).toBe(r.paletteIndex);
  });
});

describe('isRegionEdge', () => {
  it('reports boundaries between regions and at the grid edge', () => {
    const map = computeRegions(grid([[0, 0, 1]]), 3, 1);
    expect(isRegionEdge(map, 0, 0, 1, 0)).toBe(false);
    expect(isRegionEdge(map, 1, 0, 2, 0)).toBe(true);
    expect(isRegionEdge(map, 0, 0, -1, 0)).toBe(true);
  });
});
