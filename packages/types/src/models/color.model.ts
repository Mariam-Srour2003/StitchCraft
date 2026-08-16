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

/** A reference thread/drill color from a known manufacturer palette (e.g. DMC). */
export interface DmcColor {
  code: string;
  name: string;
  hex: string;
  rgb: Rgb;
  lab: Lab;
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
