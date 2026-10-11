import { computeRegions, isRegionEdge, mergeSmallRegions } from './regions';

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
    expect(map.regions[0]).toMatchObject({ labelX: 2, labelY: 2, labelDepth: 2 });
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

describe('mergeSmallRegions', () => {
  const text = (rows: Int16Array[]) =>
    rows.map((row) => [...row].map((v) => (v < 0 ? '.' : String(v))).join(''));
  const rowsOf = (lines: string[]) =>
    lines.map((line) => Int16Array.from([...line].map((c) => (c === '.' ? -1 : Number(c)))));

  it('repaints a tiny area with the colour it borders most', () => {
    const { rows, merged } = mergeSmallRegions(rowsOf(['0000', '0110', '0000', '2222']), 3);
    expect(text(rows)).toEqual(['0000', '0000', '0000', '2222']);
    expect(merged).toBe(1);
  });

  it('keeps areas at or above the minimum, and unchanged rows keep their identity', () => {
    const input = rowsOf(['000', '111', '222']);
    const { rows, merged } = mergeSmallRegions(input, 3);
    expect(merged).toBe(0);
    expect(rows[0]).toBe(input[0]);
  });

  it('follows the longest shared border', () => {
    // the single 3 touches 0 on two sides and 1 on one
    const { rows } = mergeSmallRegions(rowsOf(['0001', '0031', '0001']), 2);
    expect(rows[1][2]).toBe(0);
  });

  it('runs more passes when one merge leaves another area small', () => {
    const { rows } = mergeSmallRegions(rowsOf(['00000', '01200', '00000']), 2);
    expect(text(rows)).toEqual(['00000', '00000', '00000']);
  });

  it('leaves areas surrounded only by empty cells', () => {
    const { merged } = mergeSmallRegions(rowsOf(['...', '.4.', '...']), 3);
    expect(merged).toBe(0);
  });
});
