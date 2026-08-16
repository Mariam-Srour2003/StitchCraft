import { srgbToLab } from '../space/srgb-lab';
import { ciede2000 } from './ciede2000';

describe('ciede2000', () => {
  it('is zero for identical colors', () => {
    const lab = { l: 42, a: 13, b: -7 };
    expect(ciede2000(lab, lab)).toBeCloseTo(0, 8);
    expect(ciede2000({ l: 0, a: 0, b: 0 }, { l: 0, a: 0, b: 0 })).toBe(0);
  });

  it('is symmetric', () => {
    const a = { l: 60.26, a: -34.01, b: 36.27 };
    const b = { l: 60.46, a: -34.18, b: 39.44 };
    expect(ciede2000(a, b)).toBeCloseTo(ciede2000(b, a), 10);
  });

  it('reduces to |dL| for two achromatic colors whose mean L is 50', () => {
    // when a=b=0 for both colors, all chroma/hue terms vanish, and SL=1
    // exactly when (Lbar'-50)=0, so DeltaE00 collapses to |L2-L1|.
    const gray1 = { l: 30, a: 0, b: 0 };
    const gray2 = { l: 70, a: 0, b: 0 };
    expect(ciede2000(gray1, gray2)).toBeCloseTo(40, 6);
  });

  it('increases monotonically with lightness distance for achromatic colors', () => {
    const base = { l: 50, a: 0, b: 0 };
    const near = { l: 55, a: 0, b: 0 };
    const far = { l: 90, a: 0, b: 0 };
    expect(ciede2000(base, near)).toBeLessThan(ciede2000(base, far));
  });

  it('rates a red closer to orange than to cyan (real-world ordering sanity check)', () => {
    const red = srgbToLab({ r: 220, g: 20, b: 20 });
    const orange = srgbToLab({ r: 230, g: 126, b: 34 });
    const cyan = srgbToLab({ r: 20, g: 200, b: 210 });

    expect(ciede2000(red, orange)).toBeLessThan(ciede2000(red, cyan));
  });

  it('rates pure black vs pure white as a large difference, near the top of the scale', () => {
    const black = srgbToLab({ r: 0, g: 0, b: 0 });
    const white = srgbToLab({ r: 255, g: 255, b: 255 });
    expect(ciede2000(black, white)).toBeGreaterThan(90);
  });
});
