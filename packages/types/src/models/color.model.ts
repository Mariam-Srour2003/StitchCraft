export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

/**
 * A colour from a manufacturer's catalogue: a DMC thread, or (with `brand`
 * set) a fuse bead such as Perler or Hama. The name is historical; DMC was
 * the only catalogue at first.
 */
export interface DmcColor {
  code: string;
  name: string;
  hex: string;
  rgb: Rgb;
  lab: Lab;
  /** Maker, for catalogues other than DMC thread (e.g. 'Perler'). Absent means DMC. */
  brand?: string;
  /** Bead finish; only bead catalogues set it. */
  finish?: BeadFinish;
}

/**
 * How a fuse bead looks once ironed. Anything but `solid` (see-through,
 * sparkly, glowing...) reads differently from its swatch, so photo conversion
 * leaves those out unless asked.
 */
export type BeadFinish =
  'solid' | 'translucent' | 'glow' | 'glitter' | 'pearl' | 'neon' | 'metallic' | 'striped';

/** One fuse-bead product line, e.g. Hama Midi. */
export interface BeadCatalogue {
  /** Stable id, stored on patterns, e.g. 'hama-midi'. */
  id: string;
  brand: string;
  /** Product line as sold, e.g. 'Hama Midi'. */
  line: string;
  /** Bead diameter (and peg spacing) in millimetres. */
  beadSizeMm: number;
  colors: DmcColor[];
}

/** A user-defined color not backed by a manufacturer catalog entry. */
export interface CustomColor {
  hex: string;
  rgb: Rgb;
  label?: string;
}

export function isDmcColor(color: DmcColor | CustomColor): color is DmcColor {
  return 'code' in color;
}

/** "DMC 310 — Black", "Hama H01 — White", or a custom colour's label or hex. */
export function catalogueLabel(color: DmcColor | CustomColor): string {
  if (!isDmcColor(color)) return color.label ?? color.hex;
  return `${color.brand ?? 'DMC'} ${color.code} — ${color.name}`;
}
