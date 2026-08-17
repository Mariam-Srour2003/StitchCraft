import { srgbToLab } from '../space/srgb-lab';
import { nearestColorIndex } from './nearest-color-index';

describe('nearestColorIndex', () => {
  const palette = [
    srgbToLab({ r: 255, g: 0, b: 0 }), // red
    srgbToLab({ r: 0, g: 255, b: 0 }), // green
    srgbToLab({ r: 0, g: 0, b: 255 }), // blue
  ];

  it('picks the exact match when the target equals a palette color', () => {
    expect(nearestColorIndex(palette[1], palette)).toBe(1);
  });

  it('picks the perceptually closest color for an in-between shade', () => {
    const orangeRed = srgbToLab({ r: 230, g: 60, b: 20 }); // closer to red than green/blue
    expect(nearestColorIndex(orangeRed, palette)).toBe(0);
  });

  it('works with a single-color palette', () => {
    expect(nearestColorIndex(srgbToLab({ r: 10, g: 200, b: 10 }), [palette[1]])).toBe(0);
  });

  it('throws on an empty palette', () => {
    expect(() => nearestColorIndex(palette[0], [])).toThrow();
  });
});
