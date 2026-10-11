import { Injectable } from '@angular/core';

import { Backstitch, PaletteEntry } from '@stitchcraft/types';

import { computeRegions, isRegionEdge, RegionMap } from '@app/domain/grid/regions';

import {
  colorHexForCell,
  glyphForMode,
  GridTheme,
  isBoldGridLine,
  RenderMode,
} from './grid-render-math';

export interface GridRenderParams {
  /** Decoded grid rows; a cell value of -1 (EMPTY_CELL from @stitchcraft/types) means unpainted. */
  grid: readonly (Int16Array | number[])[];
  width: number;
  height: number;
  palette: readonly PaletteEntry[];
  mode: RenderMode;
  cellSize: number;
  theme: GridTheme;
  /** Stitching progress rows (1 = done). Done stitches get an overlay; in paint-by-number they reveal their color. */
  progress?: readonly (Int16Array | number[])[];
  /** When set, every other color is dimmed so this one stands out. */
  highlightIndex?: number | null;
  /** Draw centre-line markers. */
  showCenter?: boolean;
  /** Precomputed regions for paint-by-number mode; computed on demand when omitted. */
  regions?: RegionMap;
}

export interface LineRenderParams {
  width: number;
  height: number;
  cellSize: number;
  lines: readonly Backstitch[];
  palette: readonly PaletteEntry[];
  /** When set, lines in other colors are faded so this color's lines stand out. */
  highlightIndex?: number | null;
  /** The line being dragged right now, drawn dashed. */
  preview?: { from: { x: number; y: number }; to: { x: number; y: number }; color: string } | null;
  /** A grid corner to mark (where the next line will snap). */
  marker?: { x: number; y: number } | null;
  markerColor?: string;
}

/**
 * Pure canvas-drawing layer for the pattern grid. Owns no business rules and
 * no Angular change detection - it just paints pixels given a snapshot of
 * state. `grid-canvas` decides *when* to call `renderAll` (full redraw: on
 * load, resize, mode/zoom change, and every change in paint-by-number mode,
 * whose region outlines depend on neighbours) vs `renderCell` (single-cell
 * repaint during an active paint stroke, so a 200x200 grid doesn't get fully
 * redrawn on every pointermove).
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
    if (params.mode === 'paint-by-number') {
      this.drawRegions(ctx, params, params.regions ?? computeRegions(params.grid, width, height));
    }
    if (params.showCenter) this.drawCenterLines(ctx, params);
  }

  /** Repaints a single cell and the grid-line segments bordering it. */
  renderCell(ctx: CanvasRenderingContext2D, params: GridRenderParams, x: number, y: number): void {
    const { cellSize } = params;
    ctx.clearRect(x * cellSize, y * cellSize, cellSize, cellSize);
    this.paintCellBody(ctx, params, x, y);
    this.drawCellBorder(ctx, params, x, y);
    if (params.showCenter) this.drawCenterLines(ctx, params, x, y);
  }

  private paintCellBody(
    ctx: CanvasRenderingContext2D,
    params: GridRenderParams,
    x: number,
    y: number,
  ): void {
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
    const done = params.progress?.[y]?.[x] === 1;

    this.paintStitch(ctx, params, hex, paletteIndex, left, top, done);

    if (done && mode !== 'paint-by-number') {
      ctx.fillStyle = theme.doneOverlay;
      ctx.fillRect(left, top, cellSize, cellSize);
    }
    const highlight = params.highlightIndex;
    if (highlight !== null && highlight !== undefined && highlight !== paletteIndex) {
      ctx.fillStyle = theme.dimOverlay;
      ctx.fillRect(left, top, cellSize, cellSize);
    }
  }

  private paintStitch(
    ctx: CanvasRenderingContext2D,
    params: GridRenderParams,
    hex: string,
    paletteIndex: number,
    left: number,
    top: number,
    done: boolean,
  ): void {
    const { mode, cellSize, palette, theme } = params;

    if (mode === 'block') {
      ctx.fillStyle = hex;
      ctx.fillRect(left, top, cellSize, cellSize);
      return;
    }

    if (mode === 'paint-by-number') {
      // Unpainted canvas is white; a region "painted" (marked done) shows its color.
      ctx.fillStyle = done ? hex : theme.paintedCellFill;
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

    if (mode === 'diamond') {
      // A faceted resin "drill" is a small gem rather than a flat square -
      // approximate that with a rotated square (rhombus) on a neutral
      // backing, distinct from block mode's flush-filled cell.
      ctx.fillStyle = theme.paintedCellFill;
      ctx.fillRect(left, top, cellSize, cellSize);
      const cx = left + cellSize / 2;
      const cy = top + cellSize / 2;
      const r = cellSize * 0.42;
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
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

  /** Thick outlines between regions and one palette number per region, at its deepest cell. */
  private drawRegions(
    ctx: CanvasRenderingContext2D,
    params: GridRenderParams,
    map: RegionMap,
  ): void {
    const { width, height, cellSize, theme } = params;
    ctx.strokeStyle = theme.regionLine;
    ctx.lineWidth = Math.max(1.5, cellSize / 10);
    ctx.beginPath();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (map.ids[y * width + x] < 0) continue;
        const left = x * cellSize;
        const top = y * cellSize;
        // Each cell owns its right and bottom edges, plus top/left on the grid border or next to an empty cell.
        if (isRegionEdge(map, x, y, x + 1, y))
          this.segment(ctx, left + cellSize, top, left + cellSize, top + cellSize);
        if (isRegionEdge(map, x, y, x, y + 1))
          this.segment(ctx, left, top + cellSize, left + cellSize, top + cellSize);
        if (x === 0 || map.ids[y * width + x - 1] < 0)
          this.segment(ctx, left, top, left, top + cellSize);
        if (y === 0 || map.ids[(y - 1) * width + x] < 0)
          this.segment(ctx, left, top, left + cellSize, top);
      }
    }
    ctx.stroke();

    const fontSize = Math.max(7, cellSize * 0.55);
    ctx.fillStyle = theme.regionText;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const region of map.regions) {
      const done = params.progress?.[region.labelY]?.[region.labelX] === 1;
      if (done) continue; // a painted region no longer needs its number
      ctx.fillText(
        String(region.paletteIndex + 1),
        region.labelX * cellSize + cellSize / 2,
        region.labelY * cellSize + cellSize / 2 + 1,
      );
    }
  }

  /**
   * Centre lines across the whole grid, or - when a cell is given - only the
   * parts that cross that cell, so single-cell repaints don't erase them.
   */
  private drawCenterLines(
    ctx: CanvasRenderingContext2D,
    params: GridRenderParams,
    cellX?: number,
    cellY?: number,
  ): void {
    const { width, height, cellSize, theme } = params;
    const cx = (width / 2) * cellSize;
    const cy = (height / 2) * cellSize;
    ctx.strokeStyle = theme.centerLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (cellX === undefined || cellY === undefined) {
      this.segment(ctx, cx, 0, cx, height * cellSize);
      this.segment(ctx, 0, cy, width * cellSize, cy);
    } else {
      const left = cellX * cellSize;
      const top = cellY * cellSize;
      if (cx >= left && cx <= left + cellSize) this.segment(ctx, cx, top, cx, top + cellSize);
      if (cy >= top && cy <= top + cellSize) this.segment(ctx, left, cy, left + cellSize, cy);
    }
    ctx.stroke();
  }

  private segment(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }

  private drawGridLines(ctx: CanvasRenderingContext2D, params: GridRenderParams): void {
    const { width, height, cellSize } = params;
    for (let i = 0; i <= width; i++) {
      this.strokeLine(
        ctx,
        params,
        i * cellSize,
        0,
        i * cellSize,
        height * cellSize,
        isBoldGridLine(i),
      );
    }
    for (let j = 0; j <= height; j++) {
      this.strokeLine(
        ctx,
        params,
        0,
        j * cellSize,
        width * cellSize,
        j * cellSize,
        isBoldGridLine(j),
      );
    }
  }

  private drawCellBorder(
    ctx: CanvasRenderingContext2D,
    params: GridRenderParams,
    x: number,
    y: number,
  ): void {
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

  /** Draws backstitch lines (plus any drag preview and snap marker) on the overlay canvas. */
  renderLines(ctx: CanvasRenderingContext2D, params: LineRenderParams): void {
    const { width, height, cellSize, lines, palette, highlightIndex } = params;
    ctx.clearRect(0, 0, width * cellSize, height * cellSize);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, cellSize * 0.15);

    for (const line of lines) {
      const entry = palette[line.paletteIndex];
      if (!entry) continue;
      const faded =
        highlightIndex !== null &&
        highlightIndex !== undefined &&
        highlightIndex !== line.paletteIndex;
      ctx.globalAlpha = faded ? 0.25 : 1;
      ctx.strokeStyle = entry.color.hex;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(line.x1 * cellSize, line.y1 * cellSize);
      ctx.lineTo(line.x2 * cellSize, line.y2 * cellSize);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const { preview, marker } = params;
    if (preview && (preview.from.x !== preview.to.x || preview.from.y !== preview.to.y)) {
      ctx.strokeStyle = preview.color;
      ctx.setLineDash([cellSize * 0.3, cellSize * 0.2]);
      ctx.beginPath();
      ctx.moveTo(preview.from.x * cellSize, preview.from.y * cellSize);
      ctx.lineTo(preview.to.x * cellSize, preview.to.y * cellSize);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (marker) {
      ctx.fillStyle = params.markerColor ?? '#d0453a';
      ctx.beginPath();
      ctx.arc(
        marker.x * cellSize,
        marker.y * cellSize,
        Math.max(2.5, cellSize * 0.14),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
}
