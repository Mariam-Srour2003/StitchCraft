import { encodeGrid, Pattern } from '@stitchcraft/types';
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
      { index: 0, symbol: 'A', color: { code: '310', name: 'Black', hex: '#000000', rgb: { r: 0, g: 0, b: 0 }, lab: { l: 0, a: 0, b: 0 } } },
      { index: 1, symbol: 'B', color: { hex: '#123456', rgb: { r: 18, g: 52, b: 86 }, label: 'Sky, Custom' } },
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
    expect(csv.split('\r\n')[0]).toBe('Symbol,DMC Code,Name,Hex,Count');
  });

  it('counts stitches per color correctly', () => {
    const csv = buildMaterialsListCsv(makePattern());
    expect(csv).toContain('A,310,Black,#000000,2');
    expect(csv).toContain('B,,"Sky, Custom",#123456,1');
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
    const csv = buildMaterialsListCsv(makePattern({ palette: [], grid: encodeGrid([[null, null, null]]) }));
    expect(csv.trim()).toBe('Symbol,DMC Code,Name,Hex,Count');
  });
});
