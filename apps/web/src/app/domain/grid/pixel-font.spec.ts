import { GLYPH_HEIGHT, measureText, SUPPORTED_CHARACTERS, textPoints } from './pixel-font';

describe('pixel font', () => {
  it('measures a single letter as 5x7', () => {
    expect(measureText('A')).toEqual({ width: 5, height: GLYPH_HEIGHT });
  });

  it('adds one cell of spacing between letters', () => {
    expect(measureText('AB').width).toBe(11);
  });

  it('treats lowercase as uppercase', () => {
    expect(textPoints('a', 0, 0)).toEqual(textPoints('A', 0, 0));
  });

  it('offsets points by the origin', () => {
    const pts = textPoints('I', 10, 20);
    expect(pts.every((p) => p.x >= 10 && p.x < 15 && p.y >= 20 && p.y < 27)).toBe(true);
    expect(pts).toContainEqual({ x: 12, y: 21 }); // the stem of the I
  });

  it('stacks lines with line spacing', () => {
    expect(measureText('A\nB').height).toBe(GLYPH_HEIGHT * 2 + 2);
    expect(Math.max(...textPoints('A\nB', 0, 0).map((p) => p.y))).toBe(15);
  });

  it('skips unsupported characters', () => {
    expect(textPoints('~', 0, 0)).toEqual([]);
    expect(measureText('A~A').width).toBe(11);
  });

  it('includes a heart for samplers', () => {
    expect(SUPPORTED_CHARACTERS).toContain('♥');
  });

  it('every glyph is 7 rows of equal width', () => {
    for (const char of SUPPORTED_CHARACTERS) {
      const pts = textPoints(char, 0, 0);
      expect(pts.every((p) => p.y >= 0 && p.y < GLYPH_HEIGHT)).toBe(true);
    }
  });
});
