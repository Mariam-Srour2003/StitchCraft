import type { PaletteEntry } from '@stitchcraft/types';

import type { CellPosition } from '@app/domain/grid/cell';
import type { RenderMode } from '@app/domain/pattern/pattern-rules';

export type { CellPosition, RenderMode };

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
  /** Centre-line markers, so stitchers can start from the middle of the fabric. */
  centerLine: string;
  /** Overlay drawn on stitches marked done in stitching mode. */
  doneOverlay: string;
  /** Overlay drawn on other colors while one color is highlighted. */
  dimOverlay: string;
  /** Region outlines and numbers in paint-by-number mode. */
  regionLine: string;
  regionText: string;
}

export const LIGHT_GRID_THEME: GridTheme = {
  emptyCellFill: '#f4f1ec',
  paintedCellFill: '#ffffff',
  gridLine: '#d8d2c8',
  gridLineBold: '#a39a8c',
  symbolText: '#2b2622',
  centerLine: '#d0453a',
  doneOverlay: 'rgba(30, 26, 22, 0.55)',
  dimOverlay: 'rgba(255, 255, 255, 0.78)',
  regionLine: '#3b3530',
  regionText: '#5a524b',
};

export const DARK_GRID_THEME: GridTheme = {
  emptyCellFill: '#24211e',
  paintedCellFill: '#f2eee8',
  gridLine: '#3a3631',
  gridLineBold: '#6b645b',
  symbolText: '#f2eee8',
  centerLine: '#ff7a6b',
  doneOverlay: 'rgba(0, 0, 0, 0.6)',
  dimOverlay: 'rgba(20, 18, 16, 0.8)',
  regionLine: '#3b3530',
  regionText: '#5a524b',
};

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
