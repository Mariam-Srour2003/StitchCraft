import { RowTally } from './row-tally';

const rows = (data: number[][]) => data.map((r) => Int16Array.from(r));

describe('RowTally', () => {
  it('counts cells and done cells per color, ignoring empties and out-of-range values', () => {
    const grid = rows([
      [0, 0, -1],
      [1, 7, 0],
    ]);
    const progress = rows([
      [1, 0, 1],
      [0, 1, 1],
    ]);
    expect(new RowTally().tally(grid, progress, 2)).toEqual({ counts: [3, 1], done: [2, 0] });
  });

  it('caches by row object: unchanged rows are not recounted, replaced rows are', () => {
    const tally = new RowTally();
    const grid = rows([
      [0, 0],
      [1, 1],
    ]);
    tally.tally(grid, [], 2);

    // Mutating in place breaks the editor's contract, which is exactly what
    // proves the cache: the stale count for row 0 is reused.
    grid[0][0] = 1;
    expect(tally.tally(grid, [], 2).counts).toEqual([2, 2]);

    // Replacing the row (what the editor does) is picked up.
    const edited = [Int16Array.from([1, 0]), grid[1]];
    expect(tally.tally(edited, [], 2).counts).toEqual([1, 3]);
  });

  it('recounts when the palette size changes', () => {
    const tally = new RowTally();
    const grid = rows([[0, 1, 2]]);
    expect(tally.tally(grid, [], 2).counts).toEqual([1, 1]);
    expect(tally.tally(grid, [], 3).counts).toEqual([1, 1, 1]);
  });

  it('handles missing progress rows', () => {
    expect(new RowTally().tally(rows([[0]]), [], 1)).toEqual({ counts: [1], done: [0] });
  });
});
