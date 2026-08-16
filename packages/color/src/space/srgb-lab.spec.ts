import { hexToRgb, labToSrgb, rgbToHex, srgbToLab } from './srgb-lab';

describe('hexToRgb / rgbToHex', () => {
  it('parses a 6-digit hex string', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('rejects malformed hex input', () => {
    expect(() => hexToRgb('#ZZZZZZ')).toThrow();
    expect(() => hexToRgb('#fff')).toThrow();
  });

  it('round-trips rgb -> hex -> rgb', () => {
    const rgb = { r: 18, g: 200, b: 91 };
    expect(hexToRgb(rgbToHex(rgb))).toEqual(rgb);
  });

  it('formats hex uppercase with a leading #', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#FFFFFF');
  });
});

describe('srgbToLab / labToSrgb', () => {
  it('maps black to L=0', () => {
    const lab = srgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(0, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  it('maps white to L=100, a=0, b=0', () => {
    const lab = srgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.l).toBeCloseTo(100, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it('maps a known reference red close to published Lab values', () => {
    // sRGB (255,0,0) is well-known to be approximately Lab(53.24, 80.09, 67.20)
    const lab = srgbToLab({ r: 255, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(53.24, 0);
    expect(lab.a).toBeCloseTo(80.09, 0);
    expect(lab.b).toBeCloseTo(67.2, 0);
  });

  it('round-trips rgb -> lab -> rgb within rounding tolerance', () => {
    const original = { r: 132, g: 47, b: 201 };
    const roundTripped = labToSrgb(srgbToLab(original));
    expect(roundTripped.r).toBeCloseTo(original.r, 0);
    expect(roundTripped.g).toBeCloseTo(original.g, 0);
    expect(roundTripped.b).toBeCloseTo(original.b, 0);
  });
});
