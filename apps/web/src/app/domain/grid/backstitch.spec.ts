import type { Backstitch } from '@stitchcraft/types';

import {
  clipLines,
  distanceToLine,
  flipLinesHorizontal,
  flipLinesVertical,
  nearestCorner,
  nearestLine,
  recolorLines,
  remapLines,
  rotateLinesClockwise,
  sameLine,
  usedLineColors,
} from './backstitch';
import { rotateClockwise } from './grid-ops';

const line = (x1: number, y1: number, x2: number, y2: number, paletteIndex = 0): Backstitch => ({
  x1,
  y1,
  x2,
  y2,
  paletteIndex,
});

describe('backstitch geometry', () => {
  it('snaps to the nearest corner, clamped to the grid', () => {
    expect(nearestCorner(1.4, 2.6, 5, 5)).toEqual({ x: 1, y: 3 });
    expect(nearestCorner(-3, 9, 5, 5)).toEqual({ x: 0, y: 5 });
  });

  it('treats a line and its reverse as the same line', () => {
    expect(sameLine(line(0, 0, 2, 1), line(2, 1, 0, 0))).toBe(true);
    expect(sameLine(line(0, 0, 2, 1), line(0, 0, 2, 2))).toBe(false);
  });

  it('measures distance to a segment, not the infinite line', () => {
    expect(distanceToLine(1, 1, line(0, 0, 2, 0))).toBe(1);
    expect(distanceToLine(5, 0, line(0, 0, 2, 0))).toBe(3);
  });

  it('finds the nearest line within range, preferring the topmost on ties', () => {
    const lines = [line(0, 0, 4, 0), line(0, 0, 4, 0, 1), line(0, 3, 4, 3)];
    expect(nearestLine(lines, 2, 0.2)).toBe(1);
    expect(nearestLine(lines, 2, 2.8)).toBe(2);
    expect(nearestLine(lines, 2, 1.5)).toBe(-1);
  });

  it('flips lines with the pattern', () => {
    expect(flipLinesHorizontal([line(0, 0, 1, 2)], 4)).toEqual([line(4, 0, 3, 2)]);
    expect(flipLinesVertical([line(0, 0, 1, 2)], 3)).toEqual([line(0, 3, 1, 1)]);
  });

  it('rotates lines exactly like the cells they outline', () => {
    // A 3x2 grid with cell (0,0) outlined by its top edge.
    const cells = [Int16Array.from([1, 0, 0]), Int16Array.from([0, 0, 0])];
    const rotatedCells = rotateClockwise(cells, 3, 2);
    // After rotation the painted cell is at (1, 0) in a 2x3 grid...
    expect(rotatedCells[0][1]).toBe(1);
    // ...and its old top edge (0,0)-(1,0) becomes its right edge (2,0)-(2,1).
    expect(rotateLinesClockwise([line(0, 0, 1, 0)], 2)).toEqual([line(2, 0, 2, 1)]);
  });

  it('drops lines that no longer fit after a resize', () => {
    expect(clipLines([line(0, 0, 3, 0), line(0, 0, 5, 0)], 4, 4)).toEqual([line(0, 0, 3, 0)]);
  });

  it('remaps, recolors and lists used colors', () => {
    const lines = [line(0, 0, 1, 0, 0), line(0, 0, 1, 0, 2)];
    expect(remapLines(lines, Int16Array.from([-1, 0, 1]))).toEqual([line(0, 0, 1, 0, 1)]);
    expect(recolorLines(lines, 2, 5).map((l) => l.paletteIndex)).toEqual([0, 5]);
    expect([...usedLineColors(lines)]).toEqual([0, 2]);
  });
});
