import type { PartialStitch } from '@stitchcraft/types';
import { findPartialStitchProblem, PART_SEGMENT } from '@stitchcraft/types';

import {
  clipPartials,
  flipPartialsHorizontal,
  flipPartialsVertical,
  partAt,
  placePartial,
  recolorPartials,
  remapPartials,
  removePartialsInCells,
  rotatePartialsClockwise,
  usedPartialColors,
} from './partial-stitches';

const s = (x: number, y: number, part: PartialStitch['part'], paletteIndex = 0): PartialStitch => ({
  x,
  y,
  part,
  paletteIndex,
});

/** Absolute end points of a stitch, for checking transforms geometrically. */
function ends(st: PartialStitch): string {
  const [x1, y1, x2, y2] = PART_SEGMENT[st.part];
  const a = `${st.x + x1},${st.y + y1}`;
  const b = `${st.x + x2},${st.y + y2}`;
  return [a, b].sort().join(' ');
}

describe('partAt', () => {
  it('picks the quadrant for quarters', () => {
    expect(partAt(2.2, 3.1, 'quarter', 10, 10)).toEqual({ x: 2, y: 3, part: 'quarter-tl' });
    expect(partAt(2.8, 3.1, 'quarter', 10, 10)?.part).toBe('quarter-tr');
    expect(partAt(2.2, 3.9, 'quarter', 10, 10)?.part).toBe('quarter-bl');
    expect(partAt(2.8, 3.9, 'quarter', 10, 10)?.part).toBe('quarter-br');
  });

  it('picks the diagonal through the clicked corner for halves', () => {
    expect(partAt(0.9, 0.1, 'half', 5, 5)?.part).toBe('half-up'); // near top-right
    expect(partAt(0.1, 0.9, 'half', 5, 5)?.part).toBe('half-up'); // near bottom-left
    expect(partAt(0.1, 0.1, 'half', 5, 5)?.part).toBe('half-down');
    expect(partAt(0.9, 0.9, 'half', 5, 5)?.part).toBe('half-down');
  });

  it('is null outside the grid', () => {
    expect(partAt(-0.1, 1, 'half', 5, 5)).toBeNull();
    expect(partAt(5, 1, 'half', 5, 5)).toBeNull();
  });
});

describe('placePartial', () => {
  it('adds a stitch', () => {
    expect(placePartial([], s(1, 1, 'half-up'))).toEqual([s(1, 1, 'half-up')]);
  });

  it('replaces whatever it overlaps in that cell only', () => {
    const before = [s(1, 1, 'half-up', 0), s(1, 1, 'quarter-tl', 1), s(2, 1, 'half-up', 0)];
    const after = placePartial(before, s(1, 1, 'quarter-tr', 2));
    expect(after).toEqual([
      s(1, 1, 'quarter-tl', 1),
      s(2, 1, 'half-up', 0),
      s(1, 1, 'quarter-tr', 2),
    ]);
    expect(findPartialStitchProblem(after, 5, 5, 3)).toBeNull();
  });

  it('recolours when the same part is placed in another colour', () => {
    expect(placePartial([s(0, 0, 'half-down', 0)], s(0, 0, 'half-down', 1))).toEqual([
      s(0, 0, 'half-down', 1),
    ]);
  });

  it('placing exactly the same stitch again removes it', () => {
    expect(placePartial([s(0, 0, 'half-down', 0)], s(0, 0, 'half-down', 0))).toEqual([]);
  });
});

it('removePartialsInCells removes only those cells, keeping identity when nothing changes', () => {
  const list = [s(0, 0, 'half-up'), s(1, 0, 'half-up')];
  expect(removePartialsInCells(list, new Set([1]), 5)).toEqual([s(0, 0, 'half-up')]);
  expect(removePartialsInCells(list, new Set([7]), 5)).toBe(list);
});

describe('transforms move stitches with their cells', () => {
  const all = [
    s(0, 0, 'half-up'),
    s(1, 0, 'half-down'),
    s(2, 1, 'quarter-tl'),
    s(0, 2, 'quarter-tr'),
    s(2, 2, 'quarter-bl'),
    s(1, 2, 'quarter-br'),
  ];
  const W = 3;
  const H = 3;

  it('flip horizontal mirrors the end points', () => {
    const flipped = flipPartialsHorizontal(all, W);
    flipped.forEach((st, i) => {
      const mirrored = ends(all[i])
        .split(' ')
        .map((p) => {
          const [x, y] = p.split(',').map(Number);
          return `${W - x},${y}`;
        })
        .sort()
        .join(' ');
      expect(ends(st)).toBe(mirrored);
    });
  });

  it('flip vertical mirrors the end points', () => {
    const flipped = flipPartialsVertical(all, H);
    flipped.forEach((st, i) => {
      const mirrored = ends(all[i])
        .split(' ')
        .map((p) => {
          const [x, y] = p.split(',').map(Number);
          return `${x},${H - y}`;
        })
        .sort()
        .join(' ');
      expect(ends(st)).toBe(mirrored);
    });
  });

  it('rotation turns the end points clockwise, like corners of backstitch lines', () => {
    const rotated = rotatePartialsClockwise(all, H);
    rotated.forEach((st, i) => {
      // corner (x, y) -> (H - y, x)
      const turned = ends(all[i])
        .split(' ')
        .map((p) => {
          const [x, y] = p.split(',').map(Number);
          return `${H - y},${x}`;
        })
        .sort()
        .join(' ');
      expect(ends(st)).toBe(turned);
    });
  });

  it('four rotations of a square pattern are the identity', () => {
    let out = all;
    for (let i = 0; i < 4; i++) out = rotatePartialsClockwise(out, H);
    expect(out).toEqual(all);
  });
});

describe('palette and size changes', () => {
  const list = [s(0, 0, 'half-up', 0), s(4, 4, 'quarter-br', 1), s(1, 1, 'half-down', 2)];

  it('clips to a smaller grid', () => {
    expect(clipPartials(list, 4, 4)).toEqual([s(0, 0, 'half-up', 0), s(1, 1, 'half-down', 2)]);
  });

  it('remaps and drops removed colours', () => {
    expect(remapPartials(list, Int16Array.from([0, -1, 1]))).toEqual([
      s(0, 0, 'half-up', 0),
      s(1, 1, 'half-down', 1),
    ]);
  });

  it('recolours and reports used colours', () => {
    expect(recolorPartials(list, 2, 0)[2].paletteIndex).toBe(0);
    expect([...usedPartialColors(list)].sort()).toEqual([0, 1, 2]);
  });
});
