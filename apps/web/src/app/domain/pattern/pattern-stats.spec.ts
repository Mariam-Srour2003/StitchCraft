import type { Pattern } from '@stitchcraft/types';
import { encodeGrid } from '@stitchcraft/types';

import { hoursRemaining, patternStats } from './pattern-stats';

function pattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'p',
    projectId: 'proj',
    name: 'P',
    type: 'cross_stitch',
    width: 3,
    height: 2,
    palette: [
      { index: 0, symbol: 'A', color: { hex: '#000000', rgb: { r: 0, g: 0, b: 0 } } },
      { index: 1, symbol: 'B', color: { hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 } } },
      { index: 2, symbol: 'C', color: { hex: '#ff0000', rgb: { r: 255, g: 0, b: 0 } } },
    ],
    grid: encodeGrid([
      [0, 0, null],
      [1, null, null],
    ]),
    meta: { createdFrom: 'blank' },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('patternStats', () => {
  it('counts painted cells and colors used', () => {
    const stats = patternStats(pattern());
    expect(stats.total).toBe(3);
    expect(stats.colorsUsed).toBe(2);
    expect(stats.perColor).toEqual([2, 1, 0]);
    expect(stats.percent).toBe(0);
  });

  it('reads progress from meta', () => {
    const stats = patternStats(
      pattern({
        meta: {
          createdFrom: 'blank',
          progress: encodeGrid([
            [1, null, null],
            [1, null, null],
          ]),
        },
      }),
    );
    expect(stats.done).toBe(2);
    expect(stats.percent).toBe(66);
  });

  it('ignores progress whose dimensions do not match', () => {
    const stats = patternStats(
      pattern({ meta: { createdFrom: 'blank', progress: encodeGrid([[1, 1, 1]]) } }),
    );
    expect(stats.done).toBe(0);
  });
});

describe('hoursRemaining', () => {
  it('rounds up to the nearest half hour', () => {
    expect(
      hoursRemaining({ total: 100, done: 10, percent: 10, colorsUsed: 1, perColor: [] }, 80),
    ).toBe(1.5);
    expect(
      hoursRemaining({ total: 10, done: 10, percent: 100, colorsUsed: 1, perColor: [] }, 80),
    ).toBe(0);
  });
});

describe('patternStats run intersection', () => {
  it('matches a cell-by-cell count when grid and progress runs do not line up', () => {
    const p = {
      id: 'x',
      projectId: 'p',
      name: 'x',
      type: 'cross_stitch' as const,
      width: 7,
      height: 1,
      palette: [
        { index: 0, symbol: 'A', color: { hex: '#000000', rgb: { r: 0, g: 0, b: 0 } } },
        { index: 1, symbol: 'B', color: { hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 } } },
      ],
      // cells: 0 0 0 _ 1 1 _
      grid: [
        [
          [0, 3],
          [null, 1],
          [1, 2],
          [null, 1],
        ],
      ] as [number | null, number][][],
      // done:  _ 1 1 1 1 _ 1  -> painted & done = cells 1,2,4 = 3
      meta: {
        createdFrom: 'blank' as const,
        progress: [
          [
            [null, 1],
            [1, 4],
            [null, 1],
            [1, 1],
          ],
        ] as [number | null, number][][],
      },
      createdAt: '',
      updatedAt: '',
    };
    expect(patternStats(p)).toMatchObject({ total: 5, done: 3, percent: 60 });
  });
});
