import {
  findPartialStitchProblem,
  partialCountByIndex,
  partialThreadByIndex,
  partsOverlap,
} from './partial-stitch';

describe('partial stitches', () => {
  it('knows which parts overlap', () => {
    expect(partsOverlap('half-up', 'half-down')).toBe(false);
    expect(partsOverlap('half-up', 'quarter-tr')).toBe(true);
    expect(partsOverlap('half-up', 'quarter-tl')).toBe(false);
    expect(partsOverlap('quarter-bl', 'quarter-bl')).toBe(true);
  });

  it('counts thread as full-stitch equivalents', () => {
    const stitches = [
      { x: 0, y: 0, part: 'half-up' as const, paletteIndex: 0 },
      { x: 0, y: 0, part: 'quarter-tl' as const, paletteIndex: 1 },
      { x: 1, y: 0, part: 'quarter-br' as const, paletteIndex: 1 },
      { x: 1, y: 0, part: 'quarter-tl' as const, paletteIndex: 9 }, // out of range: ignored
    ];
    expect(partialThreadByIndex(stitches, 2)).toEqual([0.5, 0.5]);
    expect(partialCountByIndex(stitches, 2)).toEqual([1, 2]);
    expect(partialThreadByIndex(undefined, 1)).toEqual([0]);
  });

  describe('findPartialStitchProblem', () => {
    const ok = { x: 1, y: 1, part: 'half-up', paletteIndex: 0 };

    it('accepts a valid list, including a three-quarter combination', () => {
      expect(findPartialStitchProblem([], 3, 3, 1)).toBeNull();
      expect(
        findPartialStitchProblem(
          [ok, { ...ok, part: 'quarter-tl' }, { ...ok, part: 'quarter-br' }],
          3,
          3,
          1,
        ),
      ).toBeNull();
    });

    it('rejects bad shapes and values', () => {
      expect(findPartialStitchProblem({}, 3, 3, 1)).toMatch(/array/);
      expect(findPartialStitchProblem([null], 3, 3, 1)).toMatch(/not an object/);
      expect(findPartialStitchProblem([{ ...ok, x: 1.5 }], 3, 3, 1)).toMatch(/non-integer/);
      expect(findPartialStitchProblem([{ ...ok, x: 3 }], 3, 3, 1)).toMatch(/outside/);
      expect(findPartialStitchProblem([{ ...ok, part: 'eighth' }], 3, 3, 1)).toMatch(
        /unknown part/,
      );
      expect(findPartialStitchProblem([{ ...ok, paletteIndex: 1 }], 3, 3, 1)).toMatch(/palette/);
    });

    it('rejects overlapping parts in one cell, but not in different cells', () => {
      expect(findPartialStitchProblem([ok, { ...ok, part: 'quarter-tr' }], 3, 3, 1)).toMatch(
        /overlaps/,
      );
      expect(
        findPartialStitchProblem([ok, { ...ok, x: 0, part: 'quarter-tr' }], 3, 3, 1),
      ).toBeNull();
    });
  });
});
