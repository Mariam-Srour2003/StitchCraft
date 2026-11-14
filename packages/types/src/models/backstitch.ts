/**
 * A backstitch: a straight outline stitch between two grid corners, used for
 * detail and lettering on top of the cross stitches. Corners are integer
 * points from (0, 0) at the top-left of the pattern to (width, height) at the
 * bottom-right, so a line can run along cell edges or diagonally across cells.
 */
export interface Backstitch {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Palette entry whose thread the line is stitched in. */
  paletteIndex: number;
}

/** Upper bound on lines per pattern - far beyond real charts, but it bounds request size and render cost. */
export const MAX_BACKSTITCHES = 20_000;

/** Length of a backstitch line, in cell widths. */
export function backstitchLength(line: Backstitch): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

/** Total line length per palette index, in cell widths. Out-of-range indices are ignored. */
export function backstitchLengthByIndex(
  lines: readonly Backstitch[] | undefined,
  paletteLength: number,
): number[] {
  const lengths = new Array<number>(paletteLength).fill(0);
  for (const line of lines ?? []) {
    if (line.paletteIndex >= 0 && line.paletteIndex < paletteLength) {
      lengths[line.paletteIndex] += backstitchLength(line);
    }
  }
  return lengths;
}

/**
 * Checks a backstitch list against its pattern: integer corners inside the
 * grid, non-zero length, an existing palette color, and at most
 * MAX_BACKSTITCHES lines. Returns a readable problem or null when valid.
 */
export function findBackstitchProblem(
  lines: unknown,
  width: number,
  height: number,
  paletteLength: number,
): string | null {
  if (!Array.isArray(lines)) return 'backstitches must be an array';
  if (lines.length > MAX_BACKSTITCHES) {
    return `too many backstitches (${lines.length}, max ${MAX_BACKSTITCHES})`;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as Partial<Record<keyof Backstitch, unknown>> | null;
    if (!line || typeof line !== 'object') return `backstitch ${i} is not an object`;
    const coords: [unknown, number][] = [
      [line.x1, width],
      [line.y1, height],
      [line.x2, width],
      [line.y2, height],
    ];
    for (const [value, max] of coords) {
      if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > max) {
        return `backstitch ${i} has a corner outside the ${width}x${height} grid`;
      }
    }
    if (line.x1 === line.x2 && line.y1 === line.y2) return `backstitch ${i} has zero length`;
    const index = line.paletteIndex;
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= paletteLength) {
      return `backstitch ${i} uses palette index ${String(index)}, but the palette has ${paletteLength} colors`;
    }
  }
  return null;
}
