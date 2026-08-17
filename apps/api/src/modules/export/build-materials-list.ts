import type { Pattern } from '@stitchcraft/types';
import { isDmcColor } from '@stitchcraft/types';
import { countPaletteUsage } from './count-palette-usage';

/**
 * A CSV shopping list: symbol, DMC code, name, hex, and stitch/drill count
 * per color, sorted by count descending (buy the most-needed thread first).
 */
export function buildMaterialsListCsv(pattern: Pattern): string {
  const counts = countPaletteUsage(pattern);

  const rows = pattern.palette
    .map((entry, i) => ({ entry, count: counts[i] }))
    .sort((a, b) => b.count - a.count)
    .map(({ entry, count }) => {
      const { color } = entry;
      const code = isDmcColor(color) ? color.code : '';
      const name = isDmcColor(color) ? color.name : (color.label ?? '');
      return [entry.symbol, code, name, color.hex, String(count)].map(csvField).join(',');
    });

  const header = ['Symbol', 'DMC Code', 'Name', 'Hex', 'Count'].map(csvField).join(',');
  return [header, ...rows].join('\r\n') + '\r\n';
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
