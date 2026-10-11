import {
  countCellsByIndex,
  decodeGrid,
  decodeRow,
  EMPTY_CELL,
  encodeGrid,
  encodeRow,
  findGridProblem,
} from './grid';

describe('grid encoding', () => {
  it('encodes a uniform row as a single run', () => {
    expect(encodeRow([2, 2, 2, 2])).toEqual([[2, 4]]);
  });

  it('encodes alternating cells as separate runs', () => {
    expect(encodeRow([1, 1, null, null, 3])).toEqual([
      [1, 2],
      [null, 2],
      [3, 1],
    ]);
  });

  it('encodes an empty row as an empty run list', () => {
    expect(encodeRow([])).toEqual([]);
  });

  it('round-trips through encode -> decode', () => {
    const original = [0, 0, 0, null, null, 5, 5, 5, 5, 1];
    const encoded = encodeRow(original);
    const decoded = decodeRow(encoded, original.length);
    expect(Array.from(decoded)).toEqual(original.map((c) => c ?? EMPTY_CELL));
  });

  it('decodes a blank row to all-empty sentinel values', () => {
    const decoded = decodeRow([], 5);
    expect(Array.from(decoded)).toEqual([
      EMPTY_CELL,
      EMPTY_CELL,
      EMPTY_CELL,
      EMPTY_CELL,
      EMPTY_CELL,
    ]);
  });

  it('decodeGrid decodes every row against a fixed width', () => {
    const grid = encodeGrid([
      [1, 1, 1],
      [null, null, null],
    ]);
    const decoded = decodeGrid(grid, 3);
    expect(decoded).toHaveLength(2);
    expect(Array.from(decoded[0])).toEqual([1, 1, 1]);
    expect(Array.from(decoded[1])).toEqual([EMPTY_CELL, EMPTY_CELL, EMPTY_CELL]);
  });

  it('a 200x200 blank grid encodes to one run per row, not one entry per cell', () => {
    const width = 200;
    const blankRow = new Array(width).fill(null);
    const grid = encodeGrid(new Array(200).fill(blankRow));
    for (const row of grid) {
      expect(row.length).toBe(1);
    }
  });
});

describe('findGridProblem', () => {
  const ok = [
    [
      [0, 2],
      [null, 1],
    ],
    [[1, 3]],
  ];

  it('accepts a grid that matches its pattern', () => {
    expect(findGridProblem(ok, 3, 2, 2)).toBeNull();
  });

  it('rejects the wrong number of rows', () => {
    expect(findGridProblem(ok, 3, 3, 2)).toMatch(/2 rows, expected 3/);
  });

  it('rejects rows that do not cover the width', () => {
    expect(findGridProblem([[[0, 2]]], 3, 1, 1)).toMatch(/covers 2 cells, expected 3/);
  });

  it('rejects palette indices that do not exist', () => {
    expect(findGridProblem(ok, 3, 2, 1)).toMatch(/palette index 1/);
  });

  it('rejects malformed runs and lengths', () => {
    expect(findGridProblem([[[0]]], 1, 1, 1)).toMatch(/malformed/);
    expect(findGridProblem([[[0, 0]]], 0, 1, 1)).toMatch(/invalid run length/);
    expect(findGridProblem('nope', 1, 1, 1)).toMatch(/array of rows/);
  });
});

describe('countCellsByIndex', () => {
  it('counts straight from runs, ignoring empties and unknown indices', () => {
    expect(
      countCellsByIndex(
        [
          [
            [0, 2],
            [null, 1],
            [5, 1],
          ],
          [[1, 3]],
        ],
        2,
      ),
    ).toEqual([2, 3]);
  });
});
