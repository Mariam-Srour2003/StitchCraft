/**
 * Curated single-glyph alphabet for color-by-number / diamond-painting
 * legends. Chosen for readability at small chart sizes and to avoid
 * commonly-confused pairs (O/0, I/1/l, S/5, Z/2, B/8) since the same symbol
 * gets printed both in the grid cell and the legend at very different sizes.
 * Ordered roughly by visual distinctiveness so low color-counts get the
 * clearest glyphs first.
 */
const SYMBOL_ALPHABET: readonly string[] = [
  ...'ATVXHNMWKYFEURDCJGLPQ'.split(''),
  ...'34769'.split(''), // digits with low confusion risk once letters are exhausted
  '▲',
  '●',
  '■',
  '◆',
  '▼',
  '★',
  '✚',
  '✳',
  '◐',
  '◧',
  '△',
  '○',
  '□',
  '◇',
  '▽',
  '☆',
  '✛',
  '✦',
  '◑',
  '◨',
  '▣',
  '▤',
  '▥',
  '▦',
  '▧',
  '▨',
  '◈',
  '◉',
  '◎',
];

/**
 * Assigns each of `count` palette entries a distinct, readable symbol.
 * Deterministic and stable: entry `i` always gets the same symbol for a
 * given count, so re-generating a chart doesn't reshuffle its legend.
 * Falls back to two-glyph combinations (e.g. "A●") if `count` exceeds the
 * base alphabet, so this never fails for a reasonable palette size.
 */
export function assignSymbols(count: number): string[] {
  if (count < 0) throw new Error('count must be >= 0');

  const symbols: string[] = [];
  for (let i = 0; i < count; i++) {
    symbols.push(symbolForIndex(i));
  }
  return symbols;
}

function symbolForIndex(index: number): string {
  const base = SYMBOL_ALPHABET.length;
  if (index < base) return SYMBOL_ALPHABET[index];

  const first = SYMBOL_ALPHABET[Math.floor(index / base) % base];
  const second = SYMBOL_ALPHABET[index % base];
  return `${first}${second}`;
}
