import type { Pattern } from '@stitchcraft/types';
import { isDmcColor } from '@stitchcraft/types';
import { estimateMaterial } from '@stitchcraft/color';
import { countPaletteUsage } from './count-palette-usage';

/**
 * A CSV shopping list: symbol, DMC code, name, hex, and stitch/drill count
 * per color, sorted by count descending (buy the most-needed thread first).
 * Cross-stitch and diamond patterns get a final "Skeins"/"Drill bags" column
 * from the shared `estimateMaterial` model in `@stitchcraft/color`.
 */
export function buildMaterialsListCsv(pattern: Pattern): string {
  const counts = countPaletteUsage(pattern);

  const buyHeader =
    pattern.type === 'diamond' ? 'Drill bags' : pattern.type === 'cross_stitch' ? 'Skeins' : null;

  const rows = pattern.palette
    .map((entry, i) => ({ entry, count: counts[i] }))
    .sort((a, b) => b.count - a.count)
    .map(({ entry, count }) => {
      const { color } = entry;
      const code = isDmcColor(color) ? color.code : '';
      const name = isDmcColor(color) ? color.name : (color.label ?? '');
      const fields = [entry.symbol, code, name, color.hex, String(count)];
      const estimate = estimateMaterial(pattern.type, count, {
        fabricCount: pattern.meta.fabricCount,
      });
      if (estimate) fields.push(String(estimate.quantity));
      return fields.map(csvField).join(',');
    });

  const headerFields = ['Symbol', 'DMC Code', 'Name', 'Hex', 'Count'];
  if (buyHeader) headerFields.push(buyHeader);
  const header = headerFields.map(csvField).join(',');
  return [header, ...rows].join('\r\n') + '\r\n';
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
