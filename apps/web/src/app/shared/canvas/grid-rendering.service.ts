import { Injectable } from '@angular/core';
import { PaletteEntry } from '@stitchcraft/types';
import { colorHexForCell, glyphForMode, GridTheme, isBoldGridLine, RenderMode } from './grid-render-math';

export interface GridRenderParams {
  /** Decoded grid rows; a cell value of -1 (EMPTY_CELL from @stitchcraft/types) means unpainted. */
  grid: readonly (Int16Array | number[])[];
  width: number;
  height: number;
  palette: readonly PaletteEntry[];
  mode: RenderMode;
  cellSize: number;
  theme: GridTheme;
}

/**
 * Pure canvas-drawing layer for the pattern grid. Owns no business rules and
 * no Angular change detection - it just paints pixels given a snapshot of
 * state. `grid-canvas` decides *when* to call `renderAll` (full redraw: on
 * load, resize, mode/zoom change) vs `renderCell` (single-cell repaint
 * during an active paint stroke, so a 200x200 grid doesn't get fully redrawn
 * on every pointermove).
 */
@Injectable({ providedIn: 'root' })
export class GridRenderingService {
  renderAll(ctx: CanvasRenderingContext2D, params: GridRenderParams): void {
    const { width, height, cellSize } = params;
    ctx.clearRect(0, 0, width * cellSize, height * cellSize);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.paintCellBody(ctx, params, x, y);
      }
    }
    this.drawGridLines(ctx, params);
  }

  /** Repaints a single cell and the grid-line segments bordering it. */
  renderCell(ctx: CanvasRenderingContext2D, params: GridRenderParams, x: number, y: number): void {
    const { cellSize } = params;
    ctx.clearRect(x * cellSize, y * cellSize, cellSize, cellSize);
    this.paintCellBody(ctx, params, x, y);
    this.drawCellBorder(ctx, params, x, y);
  }

  private paintCellBody(ctx: CanvasRenderingContext2D, params: GridRenderParams, x: number, y: number): void {
    const { mode, cellSize, palette, theme, grid } = params;
    const paletteIndex = grid[y][x];
    const left = x * cellSize;
    const top = y * cellSize;

    if (paletteIndex < 0) {
      ctx.fillStyle = theme.emptyCellFill;
      ctx.fillRect(left, top, cellSize, cellSize);
      return;
    }

    const hex = colorHexForCell(paletteIndex, palette) ?? theme.emptyCellFill;

    if (mode === 'block') {
      ctx.fillStyle = hex;
      ctx.fillRect(left, top, cellSize, cellSize);
      return;
    }

    if (mode === 'x-stitch') {
      ctx.fillStyle = theme.paintedCellFill;
      ctx.fillRect(left, top, cellSize, cellSize);
      ctx.strokeStyle = hex;
      ctx.lineWidth = Math.max(1, cellSize / 8);
      ctx.beginPath();
      ctx.moveTo(left + cellSize * 0.15, top + cellSize * 0.15);
      ctx.lineTo(left + cellSize * 0.85, top + cellSize * 0.85);
      ctx.moveTo(left + cellSize * 0.85, top + cellSize * 0.15);
      ctx.lineTo(left + cellSize * 0.15, top + cellSize * 0.85);
      ctx.stroke();
      return;
    }

    // symbol | number
    ctx.fillStyle = theme.paintedCellFill;
    ctx.fillRect(left, top, cellSize, cellSize);
    const glyph = glyphForMode(mode, paletteIndex, palette);
    if (glyph) {
      ctx.fillStyle = hex;
      ctx.font = `${Math.max(8, cellSize * 0.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, left + cellSize / 2, top + cellSize / 2 + 1);
    }
  }

  private drawGridLines(ctx: CanvasRenderingContext2D, params: GridRenderParams): void {
    const { width, height, cellSize } = params;
    for (let i = 0; i <= width; i++) {
      this.strokeLine(ctx, params, i * cellSize, 0, i * cellSize, height * cellSize, isBoldGridLine(i));
    }
    for (let j = 0; j <= height; j++) {
      this.strokeLine(ctx, params, 0, j * cellSize, width * cellSize, j * cellSize, isBoldGridLine(j));
    }
  }

  private drawCellBorder(ctx: CanvasRenderingContext2D, params: GridRenderParams, x: number, y: number): void {
    const { cellSize } = params;
    const left = x * cellSize;
    const top = y * cellSize;
    const right = left + cellSize;
    const bottom = top + cellSize;

    this.strokeLine(ctx, params, left, top, right, top, isBoldGridLine(y));
    this.strokeLine(ctx, params, left, bottom, right, bottom, isBoldGridLine(y + 1));
    this.strokeLine(ctx, params, left, top, left, bottom, isBoldGridLine(x));
    this.strokeLine(ctx, params, right, top, right, bottom, isBoldGridLine(x + 1));
  }

  private strokeLine(
    ctx: CanvasRenderingContext2D,
    params: GridRenderParams,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    bold: boolean,
  ): void {
    ctx.strokeStyle = bold ? params.theme.gridLineBold : params.theme.gridLine;
    ctx.lineWidth = bold ? 1.5 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}
