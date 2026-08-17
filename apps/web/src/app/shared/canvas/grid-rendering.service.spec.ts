import { PaletteEntry } from '@stitchcraft/types';
import { GridTheme } from './grid-render-math';
import { GridRenderingService, GridRenderParams } from './grid-rendering.service';

const theme: GridTheme = {
  emptyCellFill: '#EEEEEE',
  paintedCellFill: '#FFFFFF',
  gridLine: '#CCCCCC',
  gridLineBold: '#888888',
  symbolText: '#000000',
};

const palette: PaletteEntry[] = [
  { index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } },
  { index: 1, symbol: 'B', color: { hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } } },
];

function createMockCtx() {
  const fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> = [];
  const clearRectCalls: Array<{ x: number; y: number; w: number; h: number }> = [];
  const fillTextCalls: Array<{ text: string; fillStyle: string }> = [];
  const strokeCalls: Array<{ strokeStyle: string; lineWidth: number }> = [];
  const fillPathCalls: Array<{ fillStyle: string }> = [];

  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: jest.fn((x: number, y: number, w: number, h: number) =>
      fillRectCalls.push({ x, y, w, h, fillStyle: ctx.fillStyle }),
    ),
    clearRect: jest.fn((x: number, y: number, w: number, h: number) => clearRectCalls.push({ x, y, w, h })),
    fillText: jest.fn((text: string) => fillTextCalls.push({ text, fillStyle: ctx.fillStyle })),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(() => strokeCalls.push({ strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth })),
    fill: jest.fn(() => fillPathCalls.push({ fillStyle: ctx.fillStyle })),
  };

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    fillRectCalls,
    clearRectCalls,
    fillTextCalls,
    strokeCalls,
    fillPathCalls,
  };
}

function baseParams(overrides: Partial<GridRenderParams> = {}): GridRenderParams {
  return {
    grid: [Int16Array.from([0, -1])],
    width: 2,
    height: 1,
    palette,
    mode: 'block',
    cellSize: 20,
    theme,
    ...overrides,
  };
}

describe('GridRenderingService', () => {
  let service: GridRenderingService;

  beforeEach(() => {
    service = new GridRenderingService();
  });

  it('renderAll fills a painted cell with its palette hex in block mode', () => {
    const { ctx, fillRectCalls } = createMockCtx();
    service.renderAll(ctx, baseParams({ mode: 'block' }));

    const paintedCell = fillRectCalls.find((c) => c.x === 0 && c.y === 0);
    expect(paintedCell?.fillStyle).toBe('#FF0000');
  });

  it('renderAll fills an empty cell with the theme empty-cell color', () => {
    const { ctx, fillRectCalls } = createMockCtx();
    service.renderAll(ctx, baseParams({ mode: 'block' }));

    const emptyCell = fillRectCalls.find((c) => c.x === 20 && c.y === 0);
    expect(emptyCell?.fillStyle).toBe(theme.emptyCellFill);
  });

  it('renderAll draws two crossing strokes per painted cell in x-stitch mode', () => {
    const { ctx, strokeCalls } = createMockCtx();
    service.renderAll(ctx, baseParams({ mode: 'x-stitch', grid: [Int16Array.from([0])], width: 1 }));

    const cellStroke = strokeCalls.find((c) => c.strokeStyle === '#FF0000');
    expect(cellStroke).toBeDefined();
  });

  it('renderAll fills a rhombus path with the palette hex in diamond mode, on a neutral backing', () => {
    const { ctx, fillRectCalls, fillPathCalls } = createMockCtx();
    service.renderAll(ctx, baseParams({ mode: 'diamond', grid: [Int16Array.from([0])], width: 1 }));

    const backing = fillRectCalls.find((c) => c.x === 0 && c.y === 0);
    expect(backing?.fillStyle).toBe(theme.paintedCellFill);
    expect(fillPathCalls).toContainEqual({ fillStyle: '#FF0000' });
  });

  it('renderAll draws the palette symbol glyph in symbol mode', () => {
    const { ctx, fillTextCalls } = createMockCtx();
    service.renderAll(ctx, baseParams({ mode: 'symbol', grid: [Int16Array.from([1])], width: 1 }));

    expect(fillTextCalls).toContainEqual({ text: 'B', fillStyle: '#00FF00' });
  });

  it('renderAll draws the 1-based index in number mode', () => {
    const { ctx, fillTextCalls } = createMockCtx();
    service.renderAll(ctx, baseParams({ mode: 'number', grid: [Int16Array.from([1])], width: 1 }));

    expect(fillTextCalls.some((c) => c.text === '2')).toBe(true);
  });

  it('renderAll does not draw a glyph for an empty cell', () => {
    const { ctx, fillTextCalls } = createMockCtx();
    service.renderAll(ctx, baseParams({ mode: 'symbol', grid: [Int16Array.from([-1])], width: 1 }));

    expect(fillTextCalls).toHaveLength(0);
  });

  it('renderCell only clears the region for the single requested cell, not the full grid', () => {
    const { ctx, clearRectCalls } = createMockCtx();
    const params = baseParams({ width: 5, height: 5, grid: Array.from({ length: 5 }, () => Int16Array.from([0, -1, -1, -1, -1])) });

    service.renderCell(ctx, params, 2, 3);

    expect(clearRectCalls).toEqual([{ x: 40, y: 60, w: 20, h: 20 }]);
  });

  it('draws bold grid lines every 10th line and thin lines otherwise', () => {
    const { ctx, strokeCalls } = createMockCtx();
    service.renderAll(ctx, baseParams({ width: 11, height: 1, grid: [new Int16Array(11).fill(-1)] }));

    const boldStrokes = strokeCalls.filter((c) => c.strokeStyle === theme.gridLineBold);
    const thinStrokes = strokeCalls.filter((c) => c.strokeStyle === theme.gridLine);
    expect(boldStrokes.length).toBeGreaterThan(0);
    expect(thinStrokes.length).toBeGreaterThan(0);
  });
});
