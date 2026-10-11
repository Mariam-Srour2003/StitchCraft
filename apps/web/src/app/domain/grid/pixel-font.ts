import type { CellPosition } from './cell';

/**
 * A 7-row bitmap font for stamping lettering (names, dates, "Home sweet
 * home") onto a pattern - one '#' is one stitch. Letters are 5 wide;
 * punctuation can be narrower. Lowercase input is drawn as uppercase.
 */
export const GLYPH_HEIGHT = 7;
export const LETTER_SPACING = 1;
export const LINE_SPACING = 2;

const GLYPHS: Record<string, readonly string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '♥': ['.....', '.#.#.', '#####', '#####', '.###.', '..#..', '.....'],
};

/** Characters the font can draw (for UI hints). */
export const SUPPORTED_CHARACTERS = Object.keys(GLYPHS).join('');

function glyphFor(char: string): readonly string[] | null {
  return GLYPHS[char] ?? GLYPHS[char.toUpperCase()] ?? null;
}

/** Width and height in cells the text will occupy (unsupported characters are skipped). */
export function measureText(text: string): { width: number; height: number } {
  const lines = text.split('\n');
  let width = 0;
  for (const line of lines) {
    let lineWidth = 0;
    let glyphs = 0;
    for (const char of line) {
      const glyph = glyphFor(char);
      if (!glyph) continue;
      lineWidth += glyph[0].length;
      glyphs++;
    }
    lineWidth += Math.max(0, glyphs - 1) * LETTER_SPACING;
    width = Math.max(width, lineWidth);
  }
  const height = lines.length * GLYPH_HEIGHT + (lines.length - 1) * LINE_SPACING;
  return { width, height: text.length === 0 ? 0 : height };
}

/** Cells to stitch for `text` with its top-left corner at (originX, originY). */
export function textPoints(text: string, originX: number, originY: number): CellPosition[] {
  const points: CellPosition[] = [];
  text.split('\n').forEach((line, lineIndex) => {
    let cursorX = originX;
    const top = originY + lineIndex * (GLYPH_HEIGHT + LINE_SPACING);
    for (const char of line) {
      const glyph = glyphFor(char);
      if (!glyph) continue;
      glyph.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
          if (row[dx] === '#') points.push({ x: cursorX + dx, y: top + dy });
        }
      });
      cursorX += glyph[0].length + LETTER_SPACING;
    }
  });
  return points;
}
