import { countDecodedCells, remapCells, removeStrayStitches } from './stray-stitches';

const rows = (lines: string[]) =>
  lines.map((line) => Int16Array.from([...line].map((c) => (c === '.' ? -1 : Number(c)))));
const text = (grid: Int16Array[]) =>
  grid.map((row) => [...row].map((v) => (v === -1 ? '.' : String(v))).join(''));

describe('removeStrayStitches', () => {
  it('recolours a lone stitch to the colour most of its neighbours have', () => {
    const { rows: out, changed } = removeStrayStitches(rows(['000', '010', '002']));
    // the 2 in the corner touches no other 2 either, so it goes too
    expect(text(out)).toEqual(['000', '000', '000']);
    expect(changed).toBe(2);
  });

  it('decides against the original grid, so a 2-stitch clump survives', () => {
    const { rows: out, changed } = removeStrayStitches(rows(['0000', '0110', '0000']));
    expect(text(out)).toEqual(['0000', '0110', '0000']);
    expect(changed).toBe(0);
  });

  it('counts diagonal neighbours as the same colour (a diagonal line is not confetti)', () => {
    const { changed } = removeStrayStitches(rows(['100', '010', '001']));
    expect(changed).toBe(0);
  });

  it('never fills empty cells and leaves a stitch alone when only empty cells surround it', () => {
    const { rows: out, changed } = removeStrayStitches(rows(['...', '.3.', '...']));
    expect(text(out)).toEqual(['...', '.3.', '...']);
    expect(changed).toBe(0);
  });

  it('breaks ties toward the lower palette index', () => {
    // the 9 touches one 1 and one 2
    const { rows: out } = removeStrayStitches(rows(['2.1', '.9.']));
    expect(out[1][1]).toBe(1);
  });

  it('keeps unchanged rows as the same objects', () => {
    const input = rows(['000', '010', '000', '444']);
    const { rows: out } = removeStrayStitches(input);
    expect(out[0]).toBe(input[0]);
    expect(out[1]).not.toBe(input[1]);
    expect(out[3]).toBe(input[3]);
    expect(input[1][1]).toBe(1); // input untouched
  });

  it('handles an empty grid', () => {
    expect(removeStrayStitches([])).toEqual({ rows: [], changed: 0 });
  });
});

describe('countDecodedCells / remapCells', () => {
  it('counts cells per index, ignoring empty and out-of-range', () => {
    expect(countDecodedCells(rows(['01.', '119']), 3)).toEqual([1, 3, 0]);
  });

  it('remaps indices and keeps untouched rows', () => {
    const input = rows(['00', '12']);
    const out = remapCells(input, [0, 2, -1]);
    expect(out[0]).toBe(input[0]);
    expect(text(out)).toEqual(['00', '2.']);
  });
});
