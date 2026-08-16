import { Lab, Rgb } from '@stitchcraft/types';

/** D65 reference white, 2-degree observer. */
const REF_WHITE = { x: 95.047, y: 100.0, z: 108.883 };

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function srgbChannelToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearChannelToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return c * 255;
}

/** sRGB (0-255 per channel) to CIE XYZ (D65). */
function rgbToXyz({ r, g, b }: Rgb): { x: number; y: number; z: number } {
  const lr = srgbChannelToLinear(r);
  const lg = srgbChannelToLinear(g);
  const lb = srgbChannelToLinear(b);

  return {
    x: (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) * 100,
    y: (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) * 100,
    z: (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) * 100,
  };
}

function xyzToRgb({ x, y, z }: { x: number; y: number; z: number }): Rgb {
  const xn = x / 100;
  const yn = y / 100;
  const zn = z / 100;

  const lr = xn * 3.2404542 + yn * -1.5371385 + zn * -0.4985314;
  const lg = xn * -0.969266 + yn * 1.8760108 + zn * 0.041556;
  const lb = xn * 0.0556434 + yn * -0.2040259 + zn * 1.0572252;

  return {
    r: linearChannelToSrgb(lr),
    g: linearChannelToSrgb(lg),
    b: linearChannelToSrgb(lb),
  };
}

function xyzChannelToLab(t: number): number {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3) ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

function labChannelToXyz(t: number): number {
  const delta = 6 / 29;
  return t > delta ? Math.pow(t, 3) : 3 * delta * delta * (t - 4 / 29);
}

export function xyzToLab({ x, y, z }: { x: number; y: number; z: number }): Lab {
  const fx = xyzChannelToLab(x / REF_WHITE.x);
  const fy = xyzChannelToLab(y / REF_WHITE.y);
  const fz = xyzChannelToLab(z / REF_WHITE.z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToXyz({ l, a, b }: Lab): { x: number; y: number; z: number } {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  return {
    x: labChannelToXyz(fx) * REF_WHITE.x,
    y: labChannelToXyz(fy) * REF_WHITE.y,
    z: labChannelToXyz(fz) * REF_WHITE.z,
  };
}

export function srgbToLab(rgb: Rgb): Lab {
  return xyzToLab(rgbToXyz(rgb));
}

export function labToSrgb(lab: Lab): Rgb {
  return xyzToRgb(labToXyz(lab));
}
