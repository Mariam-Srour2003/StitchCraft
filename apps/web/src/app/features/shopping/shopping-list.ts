import { drillBagsNeeded, skeinFraction } from '@stitchcraft/color';
import type { DmcColor, Pattern } from '@stitchcraft/types';
import { isDmcColor } from '@stitchcraft/types';
import { patternStats } from '../../shared/pattern/pattern-stats';

export interface ShoppingLine {
  /** DMC code, or the hex for a custom color. */
  key: string;
  dmc: DmcColor | null;
  hex: string;
  label: string;
  /** Stitches or drills across all selected patterns. */
  count: number;
  /** Skeins or bags needed. */
  needed: number;
  owned: number;
  toBuy: number;
  /** Which selected patterns use it. */
  patterns: string[];
}

export interface ShoppingList {
  threads: ShoppingLine[];
  drills: ShoppingLine[];
  /** Paint-by-number patterns: listed, but paint isn't counted by the cell. */
  paints: ShoppingLine[];
}

interface Accumulator {
  dmc: DmcColor | null;
  hex: string;
  label: string;
  count: number;
  skeins: number;
  patterns: Set<string>;
}

/**
 * Totals what the selected patterns need, color by color, and subtracts
 * what's in the stash. Skeins are summed unrounded across patterns (which
 * may be on different fabrics) and rounded up once, so two patterns that
 * each need half a skein of black need one skein, not two.
 *
 * The stash only tracks floss, so drills and paints aren't subtracted.
 */
export function buildShoppingList(
  patterns: readonly Pattern[],
  owned: (code: string) => number,
  options: { strands?: number; defaultFabricCount?: number } = {},
): ShoppingList {
  const groups = {
    threads: new Map<string, Accumulator>(),
    drills: new Map<string, Accumulator>(),
    paints: new Map<string, Accumulator>(),
  };

  for (const pattern of patterns) {
    const stats = patternStats(pattern);
    const group =
      pattern.type === 'diamond'
        ? groups.drills
        : pattern.type === 'cross_stitch'
          ? groups.threads
          : groups.paints;
    const fabricCount = pattern.meta.fabricCount ?? options.defaultFabricCount ?? 14;

    pattern.palette.forEach((entry, i) => {
      const count = stats.perColor[i] ?? 0;
      if (count === 0) return;
      const color = entry.color;
      const dmc = isDmcColor(color) ? color : null;
      const key = dmc ? dmc.code : entry.color.hex.toLowerCase();
      const acc =
        group.get(key) ??
        ({
          dmc,
          hex: entry.color.hex,
          label: isDmcColor(color) ? color.name : (color.label ?? 'Custom color'),
          count: 0,
          skeins: 0,
          patterns: new Set<string>(),
        } satisfies Accumulator);
      acc.count += count;
      acc.skeins += skeinFraction(count, fabricCount, options.strands);
      acc.patterns.add(pattern.name);
      group.set(key, acc);
    });
  }

  const toLines = (map: Map<string, Accumulator>, kind: 'thread' | 'drill' | 'paint') =>
    [...map.entries()]
      .map(([key, acc]) => {
        const needed =
          kind === 'thread'
            ? Math.ceil(acc.skeins)
            : kind === 'drill'
              ? drillBagsNeeded(acc.count)
              : 0;
        const have = kind === 'thread' && acc.dmc ? owned(acc.dmc.code) : 0;
        return {
          key,
          dmc: acc.dmc,
          hex: acc.hex,
          label: acc.label,
          count: acc.count,
          needed,
          owned: have,
          toBuy: Math.max(0, Math.ceil(needed - have)),
          patterns: [...acc.patterns],
        };
      })
      .sort((a, b) => b.count - a.count);

  return {
    threads: toLines(groups.threads, 'thread'),
    drills: toLines(groups.drills, 'drill'),
    paints: toLines(groups.paints, 'paint'),
  };
}

/** Plain-text list for pasting into notes or a message to a shop. */
export function shoppingListText(list: ShoppingList): string {
  const lines: string[] = [];
  const buy = list.threads.filter((l) => l.toBuy > 0);
  if (buy.length) {
    lines.push('Floss to buy:');
    for (const l of buy) lines.push(`- ${l.dmc ? `DMC ${l.key}` : l.hex} ${l.label} × ${l.toBuy}`);
  }
  if (list.drills.length) {
    lines.push('Drills (bags of 200):');
    for (const l of list.drills)
      lines.push(`- ${l.dmc ? `DMC ${l.key}` : l.hex} ${l.label} × ${l.needed}`);
  }
  return lines.length ? lines.join('\n') + '\n' : 'Nothing to buy.\n';
}
