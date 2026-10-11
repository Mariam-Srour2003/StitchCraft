import type { PaletteEntry } from '@stitchcraft/types';

import type { GridTheme } from './grid-render-math';
import type { GridRenderParams } from './grid-rendering.service';
import { GridRenderingService } from './grid-rendering.service';

const theme: GridTheme = {
  emptyCellFill: '#EEEEEE',
  paintedCellFill: '#FFFFFF',
  gridLine: '#CCCCCC',
  gridLineBold: '#888888',
  symbolText: '#000000',
  centerLine: '#CENTER',
  doneOverlay: 'DONE',
  dimOverlay: 'DIM',
  regionLine: '#REGION',
  regionText: '#REGTXT',
};

const palette: PaletteEntry[] = [
  { index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } },
  { index: 1, symbol: 'B', color: { hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } } },
];

function createMockCtx() {
  const fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> =
    [];
  const clearRectCalls: Array<{ x: number; y: number; w: number; h: number }> = [];
  const fillTextCalls: Array<{ text: string; fillStyle: string }> = [];
  const strokeCalls: Array<{ strokeStyle: string; lineWidth: number; alpha?: number }> = [];
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
    clearRect: jest.fn((x: number, y: number, w: number, h: number) =>
      clearRectCalls.push({ x, y, w, h }),
    ),
    fillText: jest.fn((text: string) => fillTextCalls.push({ text, fillStyle: ctx.fillStyle })),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(() =>
      strokeCalls.push({
        strokeStyle: ctx.strokeStyle,
        lineWidth: ctx.lineWidth,
        alpha: ctx.globalAlpha,
      }),
    ),
    fill: jest.fn(() => fillPathCalls.push({ fillStyle: ctx.fillStyle })),
    setLineDash: jest.fn(),
    arc: jest.fn(),
    lineCap: '',
    globalAlpha: 1,
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
    service.renderAll(
      ctx,
      baseParams({ mode: 'x-stitch', grid: [Int16Array.from([0])], width: 1 }),
    );

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
    const params = baseParams({
      width: 5,
      height: 5,
      grid: Array.from({ length: 5 }, () => Int16Array.from([0, -1, -1, -1, -1])),
    });

    service.renderCell(ctx, params, 2, 3);

    expect(clearRectCalls).toEqual([{ x: 40, y: 60, w: 20, h: 20 }]);
  });

  it('draws bold grid lines every 10th line and thin lines otherwise', () => {
    const { ctx, strokeCalls } = createMockCtx();
    service.renderAll(
      ctx,
      baseParams({ width: 11, height: 1, grid: [new Int16Array(11).fill(-1)] }),
    );

    const boldStrokes = strokeCalls.filter((c) => c.strokeStyle === theme.gridLineBold);
    const thinStrokes = strokeCalls.filter((c) => c.strokeStyle === theme.gridLine);
    expect(boldStrokes.length).toBeGreaterThan(0);
    expect(thinStrokes.length).toBeGreaterThan(0);
  });

  describe('stitching, highlight, centre and paint-by-number', () => {
    const base = (overrides: Partial<GridRenderParams> = {}): GridRenderParams => ({
      grid: [Int16Array.from([0, 1]), Int16Array.from([0, 0])],
      width: 2,
      height: 2,
      palette,
      mode: 'block',
      cellSize: 10,
      theme,
      ...overrides,
    });

    it('overlays done stitches', () => {
      const mock = createMockCtx();
      new GridRenderingService().renderAll(
        mock.ctx,
        base({ progress: [Int16Array.from([1, 0]), Int16Array.from([0, 0])] }),
      );
      expect(mock.fillRectCalls.filter((c) => c.fillStyle === 'DONE')).toHaveLength(1);
    });

    it('dims every other color while one is highlighted', () => {
      const mock = createMockCtx();
      new GridRenderingService().renderAll(mock.ctx, base({ highlightIndex: 0 }));
      const dimmed = mock.fillRectCalls.filter((c) => c.fillStyle === 'DIM');
      expect(dimmed).toHaveLength(1);
      expect(dimmed[0]).toMatchObject({ x: 10, y: 0 });
    });

    it('draws centre lines only when asked', () => {
      const without = createMockCtx();
      new GridRenderingService().renderAll(without.ctx, base());
      expect(without.strokeCalls.some((c) => c.strokeStyle === '#CENTER')).toBe(false);

      const withCenter = createMockCtx();
      new GridRenderingService().renderAll(withCenter.ctx, base({ showCenter: true }));
      expect(withCenter.strokeCalls.some((c) => c.strokeStyle === '#CENTER')).toBe(true);
    });

    it('redraws the centre line through a single repainted cell', () => {
      const mock = createMockCtx();
      new GridRenderingService().renderCell(mock.ctx, base({ showCenter: true }), 1, 1);
      expect(mock.strokeCalls.some((c) => c.strokeStyle === '#CENTER')).toBe(true);
    });

    it('paint-by-number: white cells, region outlines, one number per region', () => {
      const mock = createMockCtx();
      new GridRenderingService().renderAll(mock.ctx, base({ mode: 'paint-by-number' }));
      // 2 regions: the three 0-cells (connected) and the single 1-cell
      expect(mock.fillTextCalls.map((c) => c.text).sort()).toEqual(['1', '2']);
      expect(mock.strokeCalls.some((c) => c.strokeStyle === '#REGION')).toBe(true);
      expect(mock.fillRectCalls.some((c) => c.fillStyle === '#FF0000')).toBe(false);
    });

    it('paint-by-number: a painted (done) region shows its color and drops its number', () => {
      const mock = createMockCtx();
      new GridRenderingService().renderAll(
        mock.ctx,
        base({
          mode: 'paint-by-number',
          progress: [Int16Array.from([0, 1]), Int16Array.from([0, 0])],
        }),
      );
      expect(mock.fillRectCalls.some((c) => c.fillStyle === '#00FF00')).toBe(true);
      expect(mock.fillTextCalls.map((c) => c.text)).toEqual(['1']);
    });
  });

  describe('renderLines', () => {
    const lineParams = (overrides = {}) => ({
      width: 4,
      height: 4,
      cellSize: 10,
      lines: [
        { x1: 0, y1: 0, x2: 2, y2: 2, paletteIndex: 0 },
        { x1: 0, y1: 4, x2: 4, y2: 4, paletteIndex: 1 },
      ],
      palette,
      ...overrides,
    });

    it('strokes each line in its palette color', () => {
      const mock = createMockCtx();
      new GridRenderingService().renderLines(mock.ctx, lineParams());
      expect(mock.strokeCalls.map((c) => c.strokeStyle)).toEqual(['#FF0000', '#00FF00']);
      expect(mock.ctx.moveTo).toHaveBeenCalledWith(0, 40);
      expect(mock.ctx.lineTo).toHaveBeenCalledWith(40, 40);
    });

    it('fades other colors while one is highlighted', () => {
      const mock = createMockCtx();
      new GridRenderingService().renderLines(mock.ctx, lineParams({ highlightIndex: 1 }));
      expect(mock.strokeCalls.map((c) => c.alpha)).toEqual([0.25, 1]);
    });

    it('draws a dashed preview and a snap marker', () => {
      const mock = createMockCtx();
      new GridRenderingService().renderLines(
        mock.ctx,
        lineParams({
          lines: [],
          preview: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, color: '#123456' },
          marker: { x: 1, y: 0 },
        }),
      );
      expect(mock.strokeCalls.map((c) => c.strokeStyle)).toEqual(['#123456']);
      expect(mock.ctx.setLineDash).toHaveBeenCalledWith([3, 2]);
      expect(mock.ctx.arc).toHaveBeenCalled();
    });

    it('draws partial stitches under the lines: dark edges first, then thread colours', () => {
      const mock = createMockCtx();
      new GridRenderingService().renderLines(
        mock.ctx,
        lineParams({
          lines: [{ x1: 0, y1: 0, x2: 1, y2: 0, paletteIndex: 1 }],
          partials: [
            { x: 1, y: 1, part: 'half-up', paletteIndex: 0 },
            { x: 2, y: 2, part: 'quarter-br', paletteIndex: 1 },
          ],
        }),
      );
      const styles = mock.strokeCalls.map((c) => c.strokeStyle);
      expect(styles.slice(0, 2).every((s) => String(s).startsWith('rgba'))).toBe(true);
      expect(styles.slice(2)).toEqual(['#FF0000', '#00FF00', '#00FF00']); // partials, then the line
      // "/" in cell (1,1) runs from its bottom-left (10,20) to its top-right (20,10)
      expect(mock.ctx.moveTo).toHaveBeenCalledWith(10, 20);
      expect(mock.ctx.lineTo).toHaveBeenCalledWith(20, 10);
      // quarter from the bottom-right corner of cell (2,2) to its centre
      expect(mock.ctx.moveTo).toHaveBeenCalledWith(30, 30);
      expect(mock.ctx.lineTo).toHaveBeenCalledWith(25, 25);
    });
  });
});
