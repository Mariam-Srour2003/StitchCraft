import type { Pattern } from '@stitchcraft/types';
import { encodeGrid } from '@stitchcraft/types';

import { buildPaintByNumberPdf, splitIntoSheets } from './build-paint-by-number-pdf';

const red = { index: 0, symbol: 'A', color: { hex: '#D32F2F', rgb: { r: 211, g: 47, b: 47 } } };
const blue = {
  index: 1,
  symbol: 'T',
  color: {
    code: '820',
    name: 'Royal Blue Very Dark',
    hex: '#0E36A8',
    rgb: { r: 14, g: 54, b: 168 },
    lab: { l: 0, a: 0, b: 0 },
  },
};

function makePattern(width: number, height: number, overrides: Partial<Pattern> = {}): Pattern {
  // left half red, right half blue, with a blue square in the red half
  const rows = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      x >= width / 2 || (x > 1 && x < 4 && y > 1 && y < 4) ? 1 : 0,
    ),
  );
  return {
    id: 'p1',
    projectId: 'proj-1',
    name: 'Sunset',
    type: 'color_by_number',
    width,
    height,
    palette: [red, blue],
    grid: encodeGrid(rows),
    meta: { createdFrom: 'blank' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

describe('buildPaintByNumberPdf', () => {
  it('makes a reference page and one canvas page for a pattern up to ~77 wide', async () => {
    const pdf = await buildPaintByNumberPdf(makePattern(70, 70));
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pageCount(pdf)).toBe(2);
  });

  it('splits a big pattern over several canvas sheets', async () => {
    const pdf = await buildPaintByNumberPdf(makePattern(150, 150));
    // 7 pt cells: at most 77 x 98 per sheet -> 2 x 2 sheets of 75 x 75, plus the reference page
    expect(pageCount(pdf)).toBe(5);
  });

  it('copes with empty cells and an empty palette', async () => {
    const empty = makePattern(6, 6, {
      palette: [],
      grid: encodeGrid(Array.from({ length: 6 }, () => Array(6).fill(null))),
    });
    await expect(buildPaintByNumberPdf(empty)).resolves.toBeInstanceOf(Buffer);
  });
});

describe('splitIntoSheets', () => {
  it('covers every cell exactly once', () => {
    const sheets = splitIntoSheets(130, 100, 9);
    let covered = 0;
    for (const s of sheets) covered += (s.endX - s.startX) * (s.endY - s.startY);
    expect(covered).toBe(130 * 100);
    // at most 60 x 76 per sheet -> 3 columns of 44/44/42 and 2 rows of 50
    expect(sheets).toHaveLength(6);
    expect(sheets[0]).toEqual({ startX: 0, startY: 0, endX: 44, endY: 50 });
    expect(sheets[5]).toEqual({ startX: 88, startY: 50, endX: 130, endY: 100 });
  });

  it('uses one sheet when everything fits', () => {
    expect(splitIntoSheets(30, 30, 18)).toHaveLength(1);
  });
});
