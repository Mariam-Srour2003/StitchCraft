import type { PaletteEntry } from '@stitchcraft/types';
import {
  cellSizeForZoom,
  colorHexForCell,
  glyphForMode,
  isBoldGridLine,
  pixelToCell,
} from './grid-render-math';

const palette: PaletteEntry[] = [
  { index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } },
  { index: 1, symbol: 'B', color: { hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } } },
];

describe('isBoldGridLine', () => {
  it('is bold on every 10th line, starting at 0', () => {
    expect(isBoldGridLine(0)).toBe(true);
    expect(isBoldGridLine(10)).toBe(true);
    expect(isBoldGridLine(20)).toBe(true);
  });

  it('is not bold on other lines', () => {
    expect(isBoldGridLine(1)).toBe(false);
    expect(isBoldGridLine(9)).toBe(false);
    expect(isBoldGridLine(11)).toBe(false);
  });
});

describe('cellSizeForZoom', () => {
  it('returns the base size at 100% zoom', () => {
    expect(cellSizeForZoom(20, 100)).toBe(20);
  });

  it('scales proportionally', () => {
    expect(cellSizeForZoom(20, 50)).toBe(10);
    expect(cellSizeForZoom(20, 200)).toBe(40);
  });

  it('never returns less than the minimum paintable size', () => {
    expect(cellSizeForZoom(20, 1)).toBeGreaterThanOrEqual(2);
  });
});

describe('pixelToCell', () => {
  const cellSize = 10;
  const width = 5;
  const height = 5;

  it('maps a pixel to its containing cell', () => {
    expect(pixelToCell(0, 0, cellSize, width, height)).toEqual({ x: 0, y: 0 });
    expect(pixelToCell(15, 25, cellSize, width, height)).toEqual({ x: 1, y: 2 });
  });

  it('maps the last pixel inside the grid to the last cell', () => {
    expect(pixelToCell(49, 49, cellSize, width, height)).toEqual({ x: 4, y: 4 });
  });

  it('returns null for pixels outside the grid bounds', () => {
    expect(pixelToCell(-1, 0, cellSize, width, height)).toBeNull();
    expect(pixelToCell(0, -1, cellSize, width, height)).toBeNull();
    expect(pixelToCell(50, 0, cellSize, width, height)).toBeNull();
    expect(pixelToCell(0, 50, cellSize, width, height)).toBeNull();
  });
});

describe('glyphForMode', () => {
  it('returns the palette symbol in symbol mode', () => {
    expect(glyphForMode('symbol', 0, palette)).toBe('A');
    expect(glyphForMode('symbol', 1, palette)).toBe('B');
  });

  it('returns a 1-based index string in number mode', () => {
    expect(glyphForMode('number', 0, palette)).toBe('1');
    expect(glyphForMode('number', 1, palette)).toBe('2');
  });

  it('returns null for block, x-stitch, and diamond modes', () => {
    expect(glyphForMode('block', 0, palette)).toBeNull();
    expect(glyphForMode('x-stitch', 0, palette)).toBeNull();
    expect(glyphForMode('diamond', 0, palette)).toBeNull();
  });

  it('returns null for an out-of-range palette index', () => {
    expect(glyphForMode('symbol', 5, palette)).toBeNull();
    expect(glyphForMode('symbol', -1, palette)).toBeNull();
  });
});

describe('colorHexForCell', () => {
  it('resolves the hex for a valid palette index', () => {
    expect(colorHexForCell(1, palette)).toBe('#00FF00');
  });

  it('returns null for an out-of-range index (e.g. an empty cell)', () => {
    expect(colorHexForCell(-1, palette)).toBeNull();
    expect(colorHexForCell(99, palette)).toBeNull();
  });
});
