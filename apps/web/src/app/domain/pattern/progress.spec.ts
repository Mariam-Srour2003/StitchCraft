import { encodeGrid } from '@stitchcraft/types';

import { blankProgress, decodeProgress, encodeProgress } from './progress';

describe('progress codec', () => {
  it('round-trips', () => {
    const rows = [Int16Array.from([1, 0, 1]), Int16Array.from([0, 0, 0])];
    expect(decodeProgress(encodeProgress(rows), 3, 2)).toEqual(rows);
  });

  it('treats missing or mismatched progress as blank', () => {
    expect(decodeProgress(undefined, 2, 1)).toEqual(blankProgress(2, 1));
    expect(decodeProgress(encodeGrid([[1, 1]]), 2, 2)).toEqual(blankProgress(2, 2));
  });
});
