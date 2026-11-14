import type { Pattern } from '@stitchcraft/types';
import { encodeGrid } from '@stitchcraft/types';

import { buildMaterialsListCsv } from './build-materials-list';

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'p1',
    projectId: 'proj-1',
    name: 'Test',
    type: 'cross_stitch',
    width: 3,
    height: 1,
    palette: [
      {
        index: 0,
        symbol: 'A',
        color: {
          code: '310',
          name: 'Black',
          hex: '#000000',
          rgb: { r: 0, g: 0, b: 0 },
          lab: { l: 0, a: 0, b: 0 },
        },
      },
      {
        index: 1,
        symbol: 'B',
        color: { hex: '#123456', rgb: { r: 18, g: 52, b: 86 }, label: 'Sky, Custom' },
      },
    ],
    grid: encodeGrid([[0, 0, 1]]),
    meta: { createdFrom: 'blank' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildMaterialsListCsv', () => {
  it('includes a header row', () => {
    const csv = buildMaterialsListCsv(makePattern());
    expect(csv.split('\r\n')[0]).toBe('Symbol,DMC Code,Name,Hex,Count,Skeins');
  });

  it('counts stitches per color correctly', () => {
    const csv = buildMaterialsListCsv(makePattern());
    expect(csv).toContain('A,310,Black,#000000,2,1');
    expect(csv).toContain('B,,"Sky, Custom",#123456,1,1');
  });

  it('sorts rows by count, most-needed color first', () => {
    const csv = buildMaterialsListCsv(makePattern());
    const lines = csv.trim().split('\r\n');
    expect(lines[1]).toContain(',2'); // black (count 2) before sky (count 1)
    expect(lines[2]).toContain(',1');
  });

  it('quotes a name containing a comma', () => {
    const csv = buildMaterialsListCsv(makePattern());
    expect(csv).toContain('"Sky, Custom"');
  });

  it('produces just the header for an empty palette', () => {
    const csv = buildMaterialsListCsv(
      makePattern({ palette: [], grid: encodeGrid([[null, null, null]]) }),
    );
    expect(csv.trim()).toBe('Symbol,DMC Code,Name,Hex,Count,Skeins');
  });

  it('uses a "Drill bags" column for diamond patterns', () => {
    const csv = buildMaterialsListCsv(makePattern({ type: 'diamond' }));
    expect(csv.split('\r\n')[0]).toBe('Symbol,DMC Code,Name,Hex,Count,Drill bags');
    expect(csv).toContain('A,310,Black,#000000,2,1');
  });

  it('has no buy column for color-by-number (painted, not bought by count)', () => {
    const csv = buildMaterialsListCsv(makePattern({ type: 'color_by_number' }));
    expect(csv.split('\r\n')[0]).toBe('Symbol,DMC Code,Name,Hex,Count');
  });

  it('adds a backstitch length column and counts its thread when lines exist', () => {
    const csv = buildMaterialsListCsv(
      makePattern({
        meta: {
          createdFrom: 'blank',
          fabricCount: 14,
          // 14 cells of line on 14-count = 2.54 cm, in the custom color (index 1)
          backstitches: [{ x1: 0, y1: 0, x2: 14, y2: 0, paletteIndex: 1 }],
        },
      }),
    );
    const [header, ...rows] = csv.trim().split('\r\n');
    expect(header).toBe('Symbol,DMC Code,Name,Hex,Count,Backstitch (cm),Skeins');
    expect(rows).toContain('B,,"Sky, Custom",#123456,1,3,1');
    expect(rows).toContain('A,310,Black,#000000,2,0,1');
  });

  it('adds a partial stitch column and counts their thread when there are any', () => {
    const csv = buildMaterialsListCsv(
      makePattern({
        meta: {
          createdFrom: 'blank',
          partialStitches: [
            { x: 0, y: 0, part: 'half-up', paletteIndex: 1 },
            { x: 0, y: 0, part: 'quarter-tl', paletteIndex: 1 },
          ],
        },
      }),
    );
    const [header, ...rows] = csv.trim().split('\r\n');
    expect(header).toBe('Symbol,DMC Code,Name,Hex,Count,Partial stitches,Skeins');
    expect(rows).toContain('B,,"Sky, Custom",#123456,1,2,1');
    expect(rows).toContain('A,310,Black,#000000,2,0,1');
  });
});
