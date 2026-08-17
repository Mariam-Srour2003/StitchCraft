import type { CustomColor, DmcColor } from './color.model';

export interface PaletteEntry {
  /** Stable index into a Pattern's palette array; referenced by Cell/grid data. */
  index: number;
  color: DmcColor | CustomColor;
  /** Single glyph used to render this entry in symbol/number view modes. */
  symbol: string;
}

export type PaletteKind = 'dmc' | 'custom';

export interface Palette {
  id: string;
  ownerId: string | null;
  kind: PaletteKind;
  name: string;
  entries: PaletteEntry[];
  createdAt: string;
  updatedAt: string;
}
