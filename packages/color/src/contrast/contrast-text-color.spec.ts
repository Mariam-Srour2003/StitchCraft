import { contrastTextColor } from './contrast-text-color';

describe('contrastTextColor', () => {
  it('picks dark text for a light/white background', () => {
    expect(contrastTextColor({ r: 255, g: 255, b: 255 })).toBe('#000000');
  });

  it('picks light text for a dark/black background', () => {
    expect(contrastTextColor({ r: 0, g: 0, b: 0 })).toBe('#ffffff');
  });

  it('respects custom light/dark overrides', () => {
    expect(contrastTextColor({ r: 0, g: 0, b: 0 }, { light: '#eeeeee', dark: '#111111' })).toBe('#eeeeee');
    expect(contrastTextColor({ r: 255, g: 255, b: 255 }, { light: '#eeeeee', dark: '#111111' })).toBe('#111111');
  });

  it('picks dark text for a mid-tone that is still on the light side', () => {
    expect(contrastTextColor({ r: 220, g: 220, b: 220 })).toBe('#000000');
  });

  it('picks light text for a mid-tone that is on the dark side', () => {
    expect(contrastTextColor({ r: 40, g: 40, b: 40 })).toBe('#ffffff');
  });
});
