import { cellNoun, defaultRenderMode, physicalUnit, sizingMeta } from './pattern-rules';

const defaults = { fabricCount: 14, drillSizeMm: 2.8 };

describe('pattern rules', () => {
  it('picks the default view per type and purpose', () => {
    expect(defaultRenderMode('cross_stitch', 'edit')).toBe('block');
    expect(defaultRenderMode('cross_stitch', 'read')).toBe('symbol');
    expect(defaultRenderMode('diamond', 'edit')).toBe('diamond');
    expect(defaultRenderMode('color_by_number', 'read')).toBe('paint-by-number');
  });

  it('measures diamond in drill size and everything else in fabric count', () => {
    expect(physicalUnit('diamond', {}, defaults)).toBe(2.8);
    expect(physicalUnit('diamond', { drillSizeMm: 2.5 }, defaults)).toBe(2.5);
    expect(physicalUnit('cross_stitch', { fabricCount: 18 }, defaults)).toBe(18);
    expect(physicalUnit('color_by_number', {}, defaults)).toBe(14);
  });

  it('gives new patterns only the sizing field that applies', () => {
    expect(sizingMeta('diamond', defaults)).toEqual({ drillSizeMm: 2.8 });
    expect(sizingMeta('cross_stitch', defaults)).toEqual({ fabricCount: 14 });
  });

  it('names cells per craft', () => {
    expect(cellNoun('diamond')).toBe('Drills');
    expect(cellNoun('cross_stitch')).toBe('Stitches');
  });
});
