import { estimateMaterial, materialColumnLabel } from '@stitchcraft/color';
import type { Pattern } from '@stitchcraft/types';
import {
  backstitchLengthByIndex,
  isDmcColor,
  partialCountByIndex,
  partialThreadByIndex,
  toCsv,
} from '@stitchcraft/types';

import { countPaletteUsage } from './count-palette-usage';

/**
 * A CSV shopping list: symbol, DMC code, name, hex, and stitch/drill count
 * per color, sorted by count descending (buy the most-needed thread first).
 * Cross-stitch and diamond patterns get a final "Skeins"/"Drill bags" column
 * from the shared `estimateMaterial` model in `@stitchcraft/color`.
 */
export function buildMaterialsListCsv(pattern: Pattern): string {
  const counts = countPaletteUsage(pattern);
  const lineLengths = backstitchLengthByIndex(pattern.meta.backstitches, pattern.palette.length);
  const hasBackstitch = lineLengths.some((length) => length > 0);
  const partialCounts = partialCountByIndex(pattern.meta.partialStitches, pattern.palette.length);
  const partialThread = partialThreadByIndex(pattern.meta.partialStitches, pattern.palette.length);
  const hasPartials = partialCounts.some((count) => count > 0);
  const fabricCount = pattern.meta.fabricCount ?? 14;

  const buyHeader = materialColumnLabel(pattern.type);

  const rows = pattern.palette
    .map((entry, i) => ({
      entry,
      count: counts[i],
      lineLength: lineLengths[i],
      partials: partialCounts[i],
      partialThread: partialThread[i],
    }))
    .sort((a, b) => b.count - a.count || b.lineLength - a.lineLength || b.partials - a.partials)
    .map(({ entry, count, lineLength, partials, partialThread }) => {
      const { color } = entry;
      const code = isDmcColor(color) ? color.code : '';
      const name = isDmcColor(color) ? color.name : (color.label ?? '');
      const fields: string[] = [entry.symbol, code, name, color.hex, String(count)];
      if (hasPartials) fields.push(String(partials));
      if (hasBackstitch) fields.push(String(Math.round((lineLength * 2.54) / fabricCount)));
      const estimate = estimateMaterial(pattern.type, count, {
        fabricCount: pattern.meta.fabricCount,
        backstitchLength: lineLength,
        partialStitches: partialThread,
      });
      if (estimate) fields.push(String(estimate.quantity));
      return fields;
    });

  const headerFields: string[] = ['Symbol', 'DMC Code', 'Name', 'Hex', 'Count'];
  if (hasPartials) headerFields.push('Partial stitches');
  if (hasBackstitch) headerFields.push('Backstitch (cm)');
  if (buyHeader) headerFields.push(buyHeader);
  return toCsv([headerFields, ...rows]);
}
