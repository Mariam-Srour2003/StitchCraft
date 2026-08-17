import type { Pattern } from '@stitchcraft/types';
import { encodeGrid } from '@stitchcraft/types';
import { buildChartSvg } from './build-chart-svg';

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'p1',
    projectId: 'proj-1',
    name: 'Test',
    type: 'cross_stitch',
    width: 2,
    height: 2,
    palette: [{ index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } }],
    grid: encodeGrid([
      [0, null],
      [null, null],
    ]),
    meta: { createdFrom: 'blank' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildChartSvg', () => {
  it('produces a well-formed svg root sized to width*height*cellSize', () => {
    const svg = buildChartSvg(makePattern(), { cellSize: 10 });
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('draws exactly one colored+symbol cell for a single painted cell', () => {
    const svg = buildChartSvg(makePattern(), { cellSize: 10 });
    expect(svg).toContain('fill="#FF0000"');
    expect(svg).toContain('>A<');
  });

  it('does not draw a colored rect or symbol for empty cells', () => {
    const svg = buildChartSvg(makePattern(), { cellSize: 10 });
    const coloredRects = svg.match(/fill="#FF0000"/g) ?? [];
    expect(coloredRects).toHaveLength(1); // only the one painted cell, not the 3 empty ones
  });

  it('draws (width+1) vertical and (height+1) horizontal grid lines', () => {
    const svg = buildChartSvg(
      makePattern({
        width: 3,
        height: 2,
        grid: encodeGrid([
          [null, null, null],
          [null, null, null],
        ]),
      }),
    );
    const lines = svg.match(/<line/g) ?? [];
    expect(lines).toHaveLength(4 + 3); // (3+1) vertical + (2+1) horizontal
  });

  it('escapes XML-special characters in a symbol glyph', () => {
    const svg = buildChartSvg(
      makePattern({
        palette: [
          { index: 0, symbol: '<', color: { hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } } },
        ],
      }),
    );
    expect(svg).not.toContain('>|<<'); // never an unescaped bare "<" inside text content
    expect(svg).toContain('&lt;');
  });

  it('skips a cell whose palette index has no matching entry rather than throwing', () => {
    expect(() => buildChartSvg(makePattern({ palette: [] }))).not.toThrow();
  });
});
