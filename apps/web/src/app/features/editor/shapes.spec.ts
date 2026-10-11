import { clipToGrid, ellipsePoints, linePoints, mirrorPoints, rectPoints } from './shapes';

const keys = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).sort();

describe('linePoints', () => {
  it('draws a single cell for a zero-length line', () => {
    expect(linePoints({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([{ x: 2, y: 2 }]);
  });

  it('includes both ends, in either direction', () => {
    const forward = linePoints({ x: 0, y: 0 }, { x: 4, y: 2 });
    const back = linePoints({ x: 4, y: 2 }, { x: 0, y: 0 });
    expect(forward[0]).toEqual({ x: 0, y: 0 });
    expect(forward[forward.length - 1]).toEqual({ x: 4, y: 2 });
    expect(forward).toHaveLength(5);
    expect(back).toHaveLength(5);
  });

  it('draws a perfect diagonal', () => {
    expect(keys(linePoints({ x: 0, y: 0 }, { x: 3, y: 3 }))).toEqual(['0,0', '1,1', '2,2', '3,3']);
  });
});

describe('rectPoints', () => {
  it('outlines without filling the inside', () => {
    const pts = rectPoints({ x: 3, y: 3 }, { x: 0, y: 0 }, false);
    expect(pts).toHaveLength(12);
    expect(keys(pts)).not.toContain('1,1');
  });

  it('fills every cell when filled', () => {
    expect(rectPoints({ x: 0, y: 0 }, { x: 3, y: 2 }, true)).toHaveLength(12);
  });
});

describe('ellipsePoints', () => {
  it('is a single cell for a 1x1 box', () => {
    expect(ellipsePoints({ x: 1, y: 1 }, { x: 1, y: 1 }, false)).toEqual([{ x: 1, y: 1 }]);
  });

  it('drops the corners of its bounding box and is symmetric', () => {
    const pts = keys(ellipsePoints({ x: 0, y: 0 }, { x: 6, y: 6 }, true));
    expect(pts).not.toContain('0,0');
    expect(pts).not.toContain('6,6');
    expect(pts).toContain('3,0');
    expect(pts).toContain('0,3');
    expect(pts).toContain('3,3');
  });

  it('outline is a subset of the filled shape with no interior', () => {
    const filled = new Set(keys(ellipsePoints({ x: 0, y: 0 }, { x: 8, y: 6 }, true)));
    const outline = keys(ellipsePoints({ x: 0, y: 0 }, { x: 8, y: 6 }, false));
    expect(outline.every((k) => filled.has(k))).toBe(true);
    expect(outline).not.toContain('4,3');
  });
});

describe('mirrorPoints', () => {
  it('returns the input for no symmetry', () => {
    expect(mirrorPoints([{ x: 0, y: 0 }], 4, 4, 'none')).toEqual([{ x: 0, y: 0 }]);
  });

  it('mirrors across the vertical axis', () => {
    expect(keys(mirrorPoints([{ x: 0, y: 1 }], 5, 3, 'vertical'))).toEqual(['0,1', '4,1']);
  });

  it('mirrors into all four quadrants for "both"', () => {
    expect(keys(mirrorPoints([{ x: 0, y: 0 }], 4, 4, 'both'))).toEqual([
      '0,0',
      '0,3',
      '3,0',
      '3,3',
    ]);
  });

  it('does not duplicate cells on the axis', () => {
    expect(mirrorPoints([{ x: 2, y: 0 }], 5, 1, 'vertical')).toHaveLength(1);
  });
});

describe('clipToGrid', () => {
  it('drops points outside the grid', () => {
    expect(
      clipToGrid(
        [
          { x: -1, y: 0 },
          { x: 1, y: 1 },
          { x: 3, y: 0 },
        ],
        3,
        3,
      ),
    ).toEqual([{ x: 1, y: 1 }]);
  });
});
