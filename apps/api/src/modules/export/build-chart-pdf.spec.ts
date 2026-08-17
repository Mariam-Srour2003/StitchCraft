import { encodeGrid, Pattern } from '@stitchcraft/types';
import { buildChartPdf } from './build-chart-pdf';

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'p1',
    projectId: 'proj-1',
    name: 'Test Pattern',
    type: 'cross_stitch',
    width: 4,
    height: 4,
    palette: [{ index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } }],
    grid: encodeGrid(Array.from({ length: 4 }, () => [0, null, null, null])),
    meta: { createdFrom: 'blank' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildChartPdf', () => {
  it('produces a buffer starting with the PDF file signature', async () => {
    const buffer = await buildChartPdf(makePattern());
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('does not throw for an empty palette', async () => {
    const pattern = makePattern({ palette: [], grid: encodeGrid(Array.from({ length: 4 }, () => [null, null, null, null])) });
    await expect(buildChartPdf(pattern)).resolves.toBeInstanceOf(Buffer);
  });

  it('handles a pattern larger than one tile page without throwing', async () => {
    const width = 60;
    const height = 60;
    const pattern = makePattern({
      width,
      height,
      grid: encodeGrid(Array.from({ length: height }, () => new Array(width).fill(0))),
    });
    const buffer = await buildChartPdf(pattern);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
