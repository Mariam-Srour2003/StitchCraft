import {
  applyChanges,
  compactPalette,
  flipHorizontal,
  flipVertical,
  floodFill,
  replaceValue,
  resizeGrid,
  rotateClockwise,
} from './grid-ops';

const E = -1;

function toGrid(rows: number[][]): Int16Array[] {
  return rows.map((r) => Int16Array.from(r));
}

function asArrays(grid: Int16Array[]): number[][] {
  return grid.map((r) => Array.from(r));
}

describe('floodFill', () => {
  it('fills a 4-connected region and stops at other colors', () => {
    const grid = toGrid([
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
    ]);
    const changes = floodFill(grid, 0, 0, 2);
    expect(asArrays(applyChanges(grid, changes, 'after'))).toEqual([
      [2, 2, 1],
      [2, 1, 0],
      [1, 0, 0],
    ]);
  });

  it('does not leak through diagonal-only connections', () => {
    const grid = toGrid([
      [0, 1],
      [1, 0],
    ]);
    expect(floodFill(grid, 0, 0, 5)).toHaveLength(1);
  });

  it('fills empty cells too (fill on blank canvas)', () => {
    const grid = toGrid([
      [E, E],
      [E, E],
    ]);
    expect(floodFill(grid, 1, 1, 3)).toHaveLength(4);
  });

  it('returns no changes when the region already has the target value', () => {
    const grid = toGrid([[2, 2]]);
    expect(floodFill(grid, 0, 0, 2)).toEqual([]);
  });

  it('returns no changes for out-of-bounds coordinates', () => {
    const grid = toGrid([[0]]);
    expect(floodFill(grid, 3, 0, 1)).toEqual([]);
    expect(floodFill(grid, 0, -1, 1)).toEqual([]);
  });

  it('handles a large grid without recursion issues', () => {
    const grid = Array.from({ length: 500 }, () => new Int16Array(500).fill(E));
    expect(floodFill(grid, 250, 250, 0)).toHaveLength(250_000);
  });
});

describe('applyChanges', () => {
  it('only copies rows that change and can revert with "before"', () => {
    const grid = toGrid([
      [0, 0],
      [1, 1],
    ]);
    const changes = floodFill(grid, 0, 0, 4);
    const next = applyChanges(grid, changes, 'after');
    expect(next[1]).toBe(grid[1]);
    expect(next[0]).not.toBe(grid[0]);
    expect(asArrays(applyChanges(next, changes, 'before'))).toEqual(asArrays(grid));
  });
});

describe('resizeGrid', () => {
  it('keeps top-left overlap and pads with the empty value', () => {
    const grid = toGrid([
      [1, 2],
      [3, 4],
    ]);
    expect(asArrays(resizeGrid(grid, 2, 3, 1, E))).toEqual([[1, 2, E]]);
  });
});

describe('transforms', () => {
  const grid = () =>
    toGrid([
      [1, 2, 3],
      [4, 5, 6],
    ]);

  it('flips horizontally and vertically', () => {
    expect(asArrays(flipHorizontal(grid()))).toEqual([
      [3, 2, 1],
      [6, 5, 4],
    ]);
    expect(asArrays(flipVertical(grid()))).toEqual([
      [4, 5, 6],
      [1, 2, 3],
    ]);
  });

  it('rotates 90 degrees clockwise, swapping dimensions', () => {
    expect(asArrays(rotateClockwise(grid(), 3, 2))).toEqual([
      [4, 1],
      [5, 2],
      [6, 3],
    ]);
  });

  it('four clockwise rotations are the identity', () => {
    let g = grid();
    let w = 3;
    let h = 2;
    for (let i = 0; i < 4; i++) {
      g = rotateClockwise(g, w, h);
      [w, h] = [h, w];
    }
    expect(asArrays(g)).toEqual(asArrays(grid()));
  });
});

describe('replaceValue', () => {
  it('lists every cell of one color as a change to the other', () => {
    const grid = toGrid([
      [0, 1],
      [1, E],
    ]);
    const changes = replaceValue(grid, 1, 0);
    expect(changes).toHaveLength(2);
    expect(asArrays(applyChanges(grid, changes, 'after'))).toEqual([
      [0, 0],
      [0, E],
    ]);
    expect(replaceValue(grid, 1, 1)).toEqual([]);
  });
});

describe('compactPalette', () => {
  it('drops unused entries and re-numbers the grid', () => {
    const palette = [
      { index: 0, symbol: 'A' },
      { index: 1, symbol: 'B' },
      { index: 2, symbol: 'C' },
    ];
    const grid = toGrid([[2, E, 0]]);
    const result = compactPalette(palette, grid);
    expect(result.palette).toEqual([
      { index: 0, symbol: 'A' },
      { index: 1, symbol: 'C' },
    ]);
    expect(asArrays(result.grid)).toEqual([[1, E, 0]]);
    expect(Array.from(result.remap)).toEqual([0, -1, 1]);
  });

  it('keeps colors marked as used elsewhere', () => {
    const palette = [
      { index: 0, symbol: 'A' },
      { index: 1, symbol: 'B' },
    ];
    expect(compactPalette(palette, toGrid([[0]]), [1]).palette).toHaveLength(2);
  });
});
