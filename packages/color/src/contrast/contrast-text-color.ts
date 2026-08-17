import type { Rgb } from '@stitchcraft/types';

/**
 * Picks readable black or white text for a glyph/label drawn on top of a
 * fill color (WCAG-ish relative luminance heuristic - not full WCAG contrast
 * ratio math, but a fast, good-enough approximation for chart glyphs and
 * swatches). Shared by the frontend (`palette-swatch`) and the server-side
 * chart export so both pick the same contrast color for the same fill.
 */
export function contrastTextColor(
  rgb: Rgb,
  options: { light?: string; dark?: string } = {},
): string {
  const { light = '#ffffff', dark = '#000000' } = options;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? dark : light;
}
