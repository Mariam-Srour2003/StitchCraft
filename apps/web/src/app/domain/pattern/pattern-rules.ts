import type { PatternMeta, PatternType } from '@stitchcraft/types';

/**
 * Per-pattern-type rules, in one place. Every screen that needs "what does
 * a diamond pattern look like / measure in / default to" asks here instead
 * of repeating `type === 'diamond' ? ... : ...` inline.
 */

/** How a grid is drawn. */
export type RenderMode =
  | 'x-stitch'
  | 'block'
  | 'symbol'
  | 'number'
  | 'diamond'
  /** White canvas, outlined regions, one number per region - like a real paint-by-number board. */
  | 'paint-by-number';

export const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  cross_stitch: 'Cross-stitch',
  color_by_number: 'Paint by number',
  diamond: 'Diamond painting',
};

export const PATTERN_TYPES: readonly PatternType[] = ['cross_stitch', 'color_by_number', 'diamond'];

/** What a single cell is called, for counts in legends and stats. */
export function cellNoun(type: PatternType): 'Drills' | 'Stitches' {
  return type === 'diamond' ? 'Drills' : 'Stitches';
}

/**
 * The view a pattern opens in. Editing cross-stitch uses solid blocks
 * (easiest to draw on); reading it uses the symbol chart (what you stitch
 * from). Diamond and paint-by-number have one natural view either way.
 */
export function defaultRenderMode(type: PatternType, purpose: 'edit' | 'read'): RenderMode {
  if (type === 'diamond') return 'diamond';
  if (type === 'color_by_number') return 'paint-by-number';
  return purpose === 'edit' ? 'block' : 'symbol';
}

export interface SizingDefaults {
  fabricCount: number;
  drillSizeMm: number;
}

/** The physical unit a pattern is measured in: drill size (mm) for diamond, fabric count otherwise. */
export function physicalUnit(
  type: PatternType,
  meta: Pick<PatternMeta, 'fabricCount' | 'drillSizeMm'>,
  defaults: SizingDefaults,
): number {
  return type === 'diamond'
    ? (meta.drillSizeMm ?? defaults.drillSizeMm)
    : (meta.fabricCount ?? defaults.fabricCount);
}

/** The sizing field a new pattern of this type should carry in its meta. */
export function sizingMeta(
  type: PatternType,
  sizing: SizingDefaults,
): Pick<PatternMeta, 'fabricCount' | 'drillSizeMm'> {
  return type === 'diamond'
    ? { drillSizeMm: sizing.drillSizeMm }
    : { fabricCount: sizing.fabricCount };
}
