import { PaletteEntry } from '@stitchcraft/types';

export type RenderMode = 'x-stitch' | 'block' | 'symbol' | 'number';

export interface GridTheme {
  /** Background painted behind an empty (unpainted) cell. */
  emptyCellFill: string;
  /** Background painted behind a painted cell in symbol/number mode, where the glyph itself carries the color. */
  paintedCellFill: string;
  gridLine: string;
  /** Every 10th grid line, per the spec's "bold every 10" guide requirement. */
  gridLineBold: string;
  /** Glyph color in symbol/number mode. */
  symbolText: string;
}

export interface CellPosition {
  x: number;
  y: number;
}

/** Grid lines are bold every 10th line (line index 0, 10, 20, ...), matching cross-stitch chart convention. */
export const BOLD_LINE_INTERVAL = 10;

export function isBoldGridLine(lineIndex: number): boolean {
  return lineIndex % BOLD_LINE_INTERVAL === 0;
}

/** Converts a zoom percentage (e.g. 100 = 1:1) into a pixel cell size, clamped to stay paintable/visible. */
export function cellSizeForZoom(baseCellSize: number, zoomPercent: number): number {
  const size = Math.round((baseCellSize * zoomPercent) / 100);
  return Math.max(2, size);
}

/**
 * Maps a pointer position (in canvas-local pixels) to a grid cell, or null if
 * outside the grid bounds. Pure so it's testable without a real canvas/DOM.
 */
export function pixelToCell(
  px: number,
  py: number,
  cellSize: number,
  width: number,
  height: number,
): CellPosition | null {
  const x = Math.floor(px / cellSize);
  const y = Math.floor(py / cellSize);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  return { x, y };
}

/** The glyph to draw for a cell in the given mode, or null when the mode doesn't draw text (block/x-stitch). */
export function glyphForMode(
  mode: RenderMode,
  paletteIndex: number,
  palette: readonly PaletteEntry[],
): string | null {
  if (paletteIndex < 0 || paletteIndex >= palette.length) return null;
  if (mode === 'symbol') return palette[paletteIndex].symbol;
  if (mode === 'number') return String(paletteIndex + 1);
  return null;
}

export function colorHexForCell(
  paletteIndex: number,
  palette: readonly PaletteEntry[],
): string | null {
  const entry = palette[paletteIndex];
  return entry ? entry.color.hex : null;
}
