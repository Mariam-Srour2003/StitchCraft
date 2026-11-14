import { defaultBoardPegs, DEFAULT_BEAD_CATALOGUE_ID, findBeadCatalogue } from '@stitchcraft/color';
import type { BeadCatalogue, PatternMeta, PatternType } from '@stitchcraft/types';
import { PATTERN_TYPE_VALUES } from '@stitchcraft/types';

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
  /** A round fuse bead with its centre hole, as placed on a pegboard. */
  | 'bead'
  /** White canvas, outlined regions, one number per region - like a real paint-by-number board. */
  | 'paint-by-number';

export const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  cross_stitch: 'Cross-stitch',
  color_by_number: 'Paint by number',
  diamond: 'Diamond painting',
  fuse_bead: 'Fuse beads',
};

export const PATTERN_TYPES: readonly PatternType[] = PATTERN_TYPE_VALUES;

/** What a single cell is called, for counts in legends and stats. */
export function cellNoun(type: PatternType): 'Drills' | 'Stitches' | 'Beads' {
  if (type === 'diamond') return 'Drills';
  if (type === 'fuse_bead') return 'Beads';
  return 'Stitches';
}

/** The bead line a fuse-bead pattern uses (Perler when it doesn't say). */
export function beadCatalogueFor(meta: Pick<PatternMeta, 'beadCatalogueId'>): BeadCatalogue {
  const catalogue =
    findBeadCatalogue(meta.beadCatalogueId ?? DEFAULT_BEAD_CATALOGUE_ID) ??
    findBeadCatalogue(DEFAULT_BEAD_CATALOGUE_ID);
  if (!catalogue) throw new Error('The default bead catalogue is missing');
  return catalogue;
}

/** Pegs along one side of a fuse-bead pattern's pegboard. */
export function boardPegsFor(meta: Pick<PatternMeta, 'beadCatalogueId' | 'boardPegs'>): number {
  return meta.boardPegs ?? defaultBoardPegs(beadCatalogueFor(meta).beadSizeMm);
}

/**
 * Every how many cells the grid draws a bold guide line: at each pegboard's
 * edge for fuse beads, so the chart shows where one board ends; every 10
 * cells otherwise, the usual counting aid.
 */
export function boldLineInterval(
  type: PatternType,
  meta: Pick<PatternMeta, 'beadCatalogueId' | 'boardPegs'>,
): number {
  return type === 'fuse_bead' ? boardPegsFor(meta) : 10;
}

/**
 * The view a pattern opens in. Editing cross-stitch uses solid blocks
 * (easiest to draw on); reading it uses the symbol chart (what you stitch
 * from). Diamond and paint-by-number have one natural view either way.
 */
export function defaultRenderMode(type: PatternType, purpose: 'edit' | 'read'): RenderMode {
  if (type === 'diamond') return 'diamond';
  if (type === 'fuse_bead') return 'bead';
  if (type === 'color_by_number') return 'paint-by-number';
  return purpose === 'edit' ? 'block' : 'symbol';
}

export interface SizingDefaults {
  fabricCount: number;
  drillSizeMm: number;
}

/**
 * The physical unit a pattern is measured in: drill size (mm) for diamond,
 * bead size (mm, from the bead line) for fuse beads, fabric count otherwise.
 */
export function physicalUnit(
  type: PatternType,
  meta: Pick<PatternMeta, 'fabricCount' | 'drillSizeMm' | 'beadCatalogueId'>,
  defaults: SizingDefaults,
): number {
  if (type === 'diamond') return meta.drillSizeMm ?? defaults.drillSizeMm;
  if (type === 'fuse_bead') return beadCatalogueFor(meta).beadSizeMm;
  return meta.fabricCount ?? defaults.fabricCount;
}

/** Fuse-bead choices for a new pattern. */
export interface BeadSizing {
  beadCatalogueId: string;
  boardPegs?: number;
}

/** The sizing fields a new pattern of this type should carry in its meta. */
export function sizingMeta(
  type: PatternType,
  sizing: SizingDefaults,
  beads?: BeadSizing,
): Pick<PatternMeta, 'fabricCount' | 'drillSizeMm' | 'beadCatalogueId' | 'boardPegs'> {
  if (type === 'diamond') return { drillSizeMm: sizing.drillSizeMm };
  if (type === 'fuse_bead') {
    const meta = { beadCatalogueId: beads?.beadCatalogueId ?? DEFAULT_BEAD_CATALOGUE_ID };
    return { ...meta, boardPegs: beads?.boardPegs ?? boardPegsFor(meta) };
  }
  return { fabricCount: sizing.fabricCount };
}
