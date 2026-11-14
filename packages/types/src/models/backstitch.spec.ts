import type {
  Backstitch} from './backstitch';
import {
  backstitchLength,
  backstitchLengthByIndex,
  findBackstitchProblem,
  MAX_BACKSTITCHES,
} from './backstitch';

const line = (overrides: Partial<Backstitch> = {}): Backstitch => ({
  x1: 0,
  y1: 0,
  x2: 3,
  y2: 4,
  paletteIndex: 0,
  ...overrides,
});

describe('backstitch', () => {
  it('measures length in cells', () => {
    expect(backstitchLength(line())).toBe(5);
  });

  it('totals length per palette color', () => {
    expect(
      backstitchLengthByIndex(
        [line(), line({ x2: 2, y2: 0, paletteIndex: 1 }), line({ paletteIndex: 9 })],
        2,
      ),
    ).toEqual([5, 2]);
    expect(backstitchLengthByIndex(undefined, 1)).toEqual([0]);
  });

  describe('findBackstitchProblem', () => {
    it('accepts lines on the grid, including its far edges', () => {
      expect(findBackstitchProblem([line({ x2: 4, y2: 4 })], 4, 4, 1)).toBeNull();
    });

    it('rejects corners outside the grid or not on an intersection', () => {
      expect(findBackstitchProblem([line({ x2: 5 })], 4, 4, 1)).toMatch(/outside/);
      expect(findBackstitchProblem([line({ x1: 0.5 })], 4, 4, 1)).toMatch(/outside/);
      expect(findBackstitchProblem([line({ y1: -1 })], 4, 4, 1)).toMatch(/outside/);
    });

    it('rejects zero-length lines and unknown colors', () => {
      expect(findBackstitchProblem([line({ x2: 0, y2: 0 })], 4, 4, 1)).toMatch(/zero length/);
      expect(findBackstitchProblem([line({ paletteIndex: 1 })], 4, 4, 1)).toMatch(
        /palette index 1/,
      );
    });

    it('rejects non-arrays, non-objects and too many lines', () => {
      expect(findBackstitchProblem('x', 4, 4, 1)).toMatch(/must be an array/);
      expect(findBackstitchProblem([null], 4, 4, 1)).toMatch(/not an object/);
      const many = new Array(MAX_BACKSTITCHES + 1).fill(line({ x2: 1, y2: 0 }));
      expect(findBackstitchProblem(many, 4, 4, 1)).toMatch(/too many/);
    });
  });
});
