import { assignSymbols } from './symbol-assign';

describe('assignSymbols', () => {
  it('returns an empty array for zero colors', () => {
    expect(assignSymbols(0)).toEqual([]);
  });

  it('returns exactly `count` symbols', () => {
    expect(assignSymbols(10)).toHaveLength(10);
    expect(assignSymbols(50)).toHaveLength(50);
  });

  it('never repeats a symbol within one call, even for large counts', () => {
    const symbols = assignSymbols(200);
    expect(new Set(symbols).size).toBe(200);
  });

  it('is stable across calls for the same count (deterministic order)', () => {
    expect(assignSymbols(30)).toEqual(assignSymbols(30));
  });

  it('assigns a prefix-stable sequence: symbol i is the same regardless of total count', () => {
    const small = assignSymbols(5);
    const large = assignSymbols(20);
    expect(large.slice(0, 5)).toEqual(small);
  });

  it('rejects a negative count', () => {
    expect(() => assignSymbols(-1)).toThrow();
  });
});
