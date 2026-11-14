import { beadStructure } from './bead-structure';

/** '#' = a bead, '.' = an empty peg. */
function grid(...lines: string[]): { rows: number[][]; width: number; height: number } {
  return {
    rows: lines.map((line) => [...line].map((c) => (c === '#' ? 0 : -1))),
    width: lines[0].length,
    height: lines.length,
  };
}

function check(...lines: string[]) {
  const g = grid(...lines);
  return beadStructure(g.rows, g.width, g.height);
}

describe('beadStructure', () => {
  it('finds nothing wrong with a solid shape', () => {
    expect(check('###', '###')).toEqual({ loose: [], pieces: 1 });
  });

  it('flags a bead that touches others only at a corner', () => {
    const result = check('##.', '##.', '..#');
    expect(result.loose).toEqual([{ x: 2, y: 2 }]);
    expect(result.pieces).toBe(2);
  });

  it('flags a bead on its own', () => {
    expect(check('#...', '...#').loose).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 1 },
    ]);
  });

  it('counts separate pieces that each hold together', () => {
    // Two letters side by side, each a solid shape.
    expect(check('##.##', '##.##')).toEqual({ loose: [], pieces: 2 });
  });

  it('follows a winding line of beads as one piece', () => {
    expect(check('###.', '..#.', '.##.', '.#..')).toEqual({ loose: [], pieces: 1 });
  });

  it('is empty for an empty board', () => {
    expect(check('...', '...')).toEqual({ loose: [], pieces: 0 });
  });
});
