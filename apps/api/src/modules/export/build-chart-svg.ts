import { contrastTextColor } from '@stitchcraft/color';
import type { Pattern } from '@stitchcraft/types';
import { decodeGrid } from '@stitchcraft/types';

const EMPTY_CELL_FILL = '#f4f1ec';
const GRID_LINE = '#d8d2c8';
const GRID_LINE_BOLD = '#a39a8c';
const BOLD_EVERY = 10;

export interface BuildChartSvgOptions {
  /** Pixels per stitch/drill cell. */
  cellSize?: number;
}

/**
 * Builds a standalone SVG chart: colored cells + symbol glyphs + grid guides
 * (bold every 10, matching the editor), same visual language as
 * `GridRenderingService`'s symbol mode but as a static, printable/embeddable
 * document. Pure string building - no canvas/DOM - so it's usable both to
 * serve `.svg` directly and as the source `sharp` rasterizes into `.png`.
 */
export function buildChartSvg(pattern: Pattern, options: BuildChartSvgOptions = {}): string {
  const cellSize = options.cellSize ?? 24;
  const decoded = decodeGrid(pattern.grid, pattern.width);
  const width = pattern.width * cellSize;
  const height = pattern.height * cellSize;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="sans-serif">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${EMPTY_CELL_FILL}" />`,
  ];

  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      const paletteIndex = decoded[y][x];
      if (paletteIndex < 0) continue;
      const entry = pattern.palette[paletteIndex];
      if (!entry) continue;

      const left = x * cellSize;
      const top = y * cellSize;
      parts.push(
        `<rect x="${left}" y="${top}" width="${cellSize}" height="${cellSize}" fill="${entry.color.hex}" />`,
      );

      const textColor = contrastTextColor(entry.color.rgb);
      const cx = left + cellSize / 2;
      const cy = top + cellSize / 2;
      parts.push(
        `<text x="${cx}" y="${cy}" fill="${textColor}" font-size="${cellSize * 0.55}" text-anchor="middle" dominant-baseline="central">${escapeXml(entry.symbol)}</text>`,
      );
    }
  }

  for (let i = 0; i <= pattern.width; i++) {
    parts.push(gridLine(i * cellSize, 0, i * cellSize, height, i % BOLD_EVERY === 0));
  }
  for (let j = 0; j <= pattern.height; j++) {
    parts.push(gridLine(0, j * cellSize, width, j * cellSize, j % BOLD_EVERY === 0));
  }

  parts.push('</svg>');
  return parts.join('');
}

function gridLine(x1: number, y1: number, x2: number, y2: number, bold: boolean): string {
  const stroke = bold ? GRID_LINE_BOLD : GRID_LINE;
  const width = bold ? 1.5 : 0.5;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" />`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
