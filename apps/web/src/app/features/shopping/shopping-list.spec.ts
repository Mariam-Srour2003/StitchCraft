import { findDmcByCode } from '@stitchcraft/color';
import type { Pattern } from '@stitchcraft/types';
import { encodeGrid } from '@stitchcraft/types';

import { buildShoppingList, shoppingListText } from './shopping-list';

const black = findDmcByCode('310')!;
const red = findDmcByCode('321')!;

function pattern(
  name: string,
  type: Pattern['type'],
  row: (number | null)[],
  fabricCount = 14,
): Pattern {
  return {
    id: name,
    projectId: 'p',
    name,
    type,
    width: row.length,
    height: 1,
    palette: [
      { index: 0, symbol: 'A', color: black },
      { index: 1, symbol: 'B', color: red },
      {
        index: 2,
        symbol: 'C',
        color: { hex: '#ABCDEF', rgb: { r: 171, g: 205, b: 239 }, label: 'Sky' },
      },
    ],
    grid: encodeGrid([row]),
    meta: { createdFrom: 'blank', fabricCount },
    createdAt: '',
    updatedAt: '',
  };
}

describe('buildShoppingList', () => {
  it('merges the same thread across patterns and rounds up once', () => {
    // 1000 stitches each is ~0.53 of a skein: two patterns need 2 skeins total only if summed > 1.
    const a = pattern('A', 'cross_stitch', new Array(1000).fill(0));
    const b = pattern('B', 'cross_stitch', new Array(800).fill(0));
    const list = buildShoppingList([a, b], () => 0, { strands: 2 });
    expect(list.threads).toHaveLength(1);
    expect(list.threads[0]).toMatchObject({
      key: '310',
      count: 1800,
      needed: 1,
      patterns: ['A', 'B'],
    });
  });

  it('subtracts the stash and never asks to buy a negative amount', () => {
    const list = buildShoppingList([pattern('A', 'cross_stitch', [0, 1, 2])], (code) =>
      code === '310' ? 5 : 0,
    );
    const byKey = Object.fromEntries(list.threads.map((l) => [l.key, l]));
    expect(byKey['310']).toMatchObject({ needed: 1, owned: 5, toBuy: 0 });
    expect(byKey['321']).toMatchObject({ needed: 1, owned: 0, toBuy: 1 });
    expect(byKey['#abcdef'].label).toBe('Sky');
  });

  it('puts diamond patterns under drills (bags) and paint-by-number under paints', () => {
    const list = buildShoppingList(
      [pattern('D', 'diamond', new Array(300).fill(1)), pattern('P', 'color_by_number', [0])],
      () => 99,
    );
    expect(list.drills[0]).toMatchObject({ key: '321', count: 300, needed: 2, owned: 0, toBuy: 2 });
    expect(list.paints[0]).toMatchObject({ key: '310', needed: 0 });
    expect(list.threads).toEqual([]);
  });

  it('formats a plain-text list', () => {
    const list = buildShoppingList([pattern('A', 'cross_stitch', [1])], () => 0);
    expect(shoppingListText(list)).toContain('DMC 321 Red × 1');
    expect(shoppingListText(buildShoppingList([], () => 0))).toBe('Nothing to buy.\n');
  });

  it('counts backstitch thread, including colors used only for lines', () => {
    const p = pattern('A', 'cross_stitch', [0]);
    p.meta.backstitches = [{ x1: 0, y1: 0, x2: 1, y2: 1, paletteIndex: 1 }];
    const list = buildShoppingList([p], () => 0);
    const red = list.threads.find((l) => l.key === '321');
    expect(red).toMatchObject({ count: 0, needed: 1, toBuy: 1 });
  });
});
