import { assignSymbols, findDmcByCode } from '@stitchcraft/color';
import type { PaletteEntry, PatternType } from '@stitchcraft/types';
import { EMPTY_CELL } from '@stitchcraft/types';
import type { CellPosition } from '@app/domain/grid/cell';
import { measureText, textPoints } from '@app/domain/grid/pixel-font';
import { ellipsePoints, linePoints, mirrorPoints, rectPoints } from '@app/domain/grid/shapes';

export type TemplateCategory =
  | 'Beginner'
  | 'Samplers'
  | 'Borders'
  | 'Gifts'
  | 'Seasonal'
  | 'Diamond painting'
  | 'Paint by number';

export interface TemplateDesign {
  width: number;
  height: number;
  palette: PaletteEntry[];
  /** Palette index per cell, -1 for empty fabric. */
  rows: number[][];
}

export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  type: PatternType;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  build(): TemplateDesign;
}

/**
 * Small drawing helper for generating designs in code. Colors are DMC codes;
 * only colors actually drawn end up in the palette, in first-use order.
 */
class Design {
  private readonly rows: number[][];
  private readonly codes: string[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.rows = Array.from({ length: height }, () => new Array(width).fill(EMPTY_CELL));
  }

  private indexOf(code: string): number {
    let i = this.codes.indexOf(code);
    if (i === -1) {
      if (!findDmcByCode(code)) throw new Error(`Unknown DMC code ${code}`);
      i = this.codes.push(code) - 1;
    }
    return i;
  }

  set(x: number, y: number, code: string): this {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.rows[y][x] = this.indexOf(code);
    return this;
  }

  get(x: number, y: number): number {
    return this.rows[y]?.[x] ?? EMPTY_CELL;
  }

  plot(points: readonly CellPosition[], code: string): this {
    for (const p of points) this.set(p.x, p.y, code);
    return this;
  }

  fill(test: (x: number, y: number) => boolean, code: string): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) if (test(x, y)) this.set(x, y, code);
    }
    return this;
  }

  /** Text centred horizontally with its top at `top`. */
  centeredText(text: string, top: number, code: string): this {
    const { width } = measureText(text);
    return this.plot(textPoints(text, Math.floor((this.width - width) / 2), top), code);
  }

  build(): TemplateDesign {
    const symbols = assignSymbols(this.codes.length);
    const palette: PaletteEntry[] = this.codes.map((code, index) => ({
      index,
      symbol: symbols[index],
      color: findDmcByCode(code)!,
    }));
    return { width: this.width, height: this.height, palette, rows: this.rows.map((r) => [...r]) };
  }
}

function heartTest(cx: number, cy: number, scale: number) {
  return (x: number, y: number) => {
    const nx = (x - cx) / scale;
    const ny = (cy - y) / scale;
    const a = nx * nx + ny * ny - 1;
    return a * a * a - nx * nx * ny * ny * ny <= 0;
  };
}

/** Cells of a filled shape that touch the outside: an outline that hugs the shape. */
function outlineOf(width: number, height: number, inside: (x: number, y: number) => boolean) {
  const points: CellPosition[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1)) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

function framed(width: number, height: number, outer: string, inner?: string): Design {
  const d = new Design(width, height);
  d.plot(rectPoints({ x: 0, y: 0 }, { x: width - 1, y: height - 1 }, false), outer);
  if (inner) d.plot(rectPoints({ x: 2, y: 2 }, { x: width - 3, y: height - 3 }, false), inner);
  return d;
}

export const TEMPLATES: readonly PatternTemplate[] = [
  {
    id: 'heart',
    name: 'Little heart',
    description: 'A classic first project: one shape, two reds and a highlight.',
    category: 'Beginner',
    type: 'cross_stitch',
    difficulty: 'Easy',
    build() {
      const w = 19;
      const h = 15;
      const d = new Design(w, h);
      const inside = heartTest(9, 7.5, 7.2);
      d.fill(inside, '321');
      d.plot(outlineOf(w, h, inside), '815');
      d.set(5, 5, 'B5200').set(6, 5, 'B5200').set(5, 6, 'B5200');
      return d.build();
    },
  },
  {
    id: 'gingham',
    name: 'Gingham practice square',
    description: 'Straight rows in two blues - perfect for practising even tension.',
    category: 'Beginner',
    type: 'cross_stitch',
    difficulty: 'Easy',
    build() {
      const d = new Design(24, 24);
      d.fill((x, y) => {
        const bx = Math.floor(x / 4) % 2 === 0;
        const by = Math.floor(y / 4) % 2 === 0;
        return bx && by;
      }, '798');
      d.fill((x, y) => (Math.floor(x / 4) % 2 === 0) !== (Math.floor(y / 4) % 2 === 0), '3755');
      return d.build();
    },
  },
  {
    id: 'alphabet-sampler',
    name: 'Alphabet sampler',
    description:
      'The traditional sampler: A to Z and numbers in rainbow rows inside a double border.',
    category: 'Samplers',
    type: 'cross_stitch',
    difficulty: 'Medium',
    build() {
      const lines = ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ', '0123456789'];
      const colors = ['321', '740', '702', '796', '552'];
      const textWidth = Math.max(...lines.map((l) => measureText(l).width));
      const w = textWidth + 12;
      const h = lines.length * 9 + 10;
      const d = framed(w, h, '310', '3350');
      lines.forEach((line, i) => d.centeredText(line, 6 + i * 9, colors[i]));
      return d.build();
    },
  },
  {
    id: 'home-sweet-home',
    name: 'Home sweet home',
    description: 'Lettering with heart corners - easy to change to your own words.',
    category: 'Samplers',
    type: 'cross_stitch',
    difficulty: 'Medium',
    build() {
      const lines = ['HOME', 'SWEET', 'HOME'];
      const w = 47;
      const h = lines.length * 9 + 17;
      const d = framed(w, h, '3812', '964');
      lines.forEach((line, i) => d.centeredText(line, 9 + i * 9, i === 1 ? '3350' : '3812'));
      for (const [x, y] of [
        [4, 4],
        [w - 9, 4],
        [4, h - 9],
        [w - 9, h - 9],
      ]) {
        d.plot(textPoints('♥', x, y - 1), '321');
      }
      return d.build();
    },
  },
  {
    id: 'diamond-border',
    name: 'Diamond border frame',
    description: 'A repeating diamond band with an empty centre for a name, date or monogram.',
    category: 'Borders',
    type: 'cross_stitch',
    difficulty: 'Medium',
    build() {
      const w = 63;
      const h = 47;
      const d = new Design(w, h);
      const band = 7;
      const inBand = (x: number, y: number) =>
        x < band || y < band || x >= w - band || y >= h - band;
      // Diamonds every 8 cells along the band, centred in it.
      d.fill((x, y) => {
        if (!inBand(x, y)) return false;
        const along = x < band || x >= w - band ? y : x;
        const across = x < band ? x : x >= w - band ? w - 1 - x : y < band ? y : h - 1 - y;
        const dx = Math.abs(((along + 4) % 8) - 4);
        const dy = Math.abs(across - 3);
        return dx + dy <= 3;
      }, '3350');
      d.fill(
        (x, y) =>
          inBand(x, y) &&
          d.get(x, y) === EMPTY_CELL &&
          (x === 0 || y === 0 || x === w - 1 || y === h - 1),
        '3354',
      );
      d.plot(rectPoints({ x: band, y: band }, { x: w - 1 - band, y: h - 1 - band }, false), '3354');
      return d.build();
    },
  },
  {
    id: 'bookmark',
    name: 'Book lover bookmark',
    description: 'A narrow bookmark with stacked lettering and hearts - a quick gift.',
    category: 'Gifts',
    type: 'cross_stitch',
    difficulty: 'Easy',
    build() {
      const w = 21;
      const letters = ['R', 'E', 'A', 'D'];
      const h = 16 + letters.length * 9 + 14;
      const d = framed(w, h, '517', '3760');
      d.centeredText('♥', 5, '321');
      letters.forEach((letter, i) => d.centeredText(letter, 15 + i * 9, '517'));
      d.centeredText('♥', h - 12, '321');
      return d.build();
    },
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    description: 'A symmetric winter motif - great for cards and ornaments.',
    category: 'Seasonal',
    type: 'cross_stitch',
    difficulty: 'Medium',
    build() {
      const size = 41;
      const c = 20;
      const d = new Design(size, size);
      const arms: CellPosition[] = [];
      // One quadrant of arms and branches, mirrored into all four.
      arms.push(...linePoints({ x: c, y: c }, { x: c, y: 1 }));
      arms.push(...linePoints({ x: c, y: c }, { x: c + 14, y: c - 14 }));
      for (const t of [6, 11, 15]) {
        arms.push(...linePoints({ x: c, y: c - t }, { x: c + 4, y: c - t - 4 }));
        // Short branches off the diagonal arm, one each way, so it stays symmetric about the arm.
        const k = Math.round(t * 0.7);
        arms.push(...linePoints({ x: c + k, y: c - k }, { x: c + k + 3, y: c - k }));
        arms.push(...linePoints({ x: c + k, y: c - k }, { x: c + k, y: c - k - 3 }));
      }
      d.plot(mirrorPoints(arms, size, size, 'both'), '798');
      d.plot(
        mirrorPoints(
          ellipsePoints({ x: c - 2, y: c - 2 }, { x: c + 2, y: c + 2 }, true),
          size,
          size,
          'none',
        ),
        '809',
      );
      for (const tip of [
        { x: c, y: 0 },
        { x: c + 15, y: c - 15 },
      ]) {
        d.plot(mirrorPoints([tip], size, size, 'both'), '775');
      }
      return d.build();
    },
  },
  {
    id: 'tulip',
    name: 'Spring tulip',
    description: 'A single tulip with leaves - a gentle introduction to shading.',
    category: 'Seasonal',
    type: 'cross_stitch',
    difficulty: 'Easy',
    build() {
      const d = new Design(23, 31);
      d.plot(linePoints({ x: 11, y: 12 }, { x: 11, y: 29 }), '702');
      d.plot(linePoints({ x: 12, y: 12 }, { x: 12, y: 29 }), '702');
      d.plot(ellipsePoints({ x: 2, y: 17 }, { x: 10, y: 22 }, true), '703');
      d.plot(ellipsePoints({ x: 13, y: 20 }, { x: 21, y: 25 }, true), '703');
      d.plot(ellipsePoints({ x: 5, y: 1 }, { x: 18, y: 14 }, true), '3350');
      d.fill(
        (x, y) =>
          y <= 3 && (x === 8 || x === 11 || x === 12 || x === 15) && d.get(x, y) !== EMPTY_CELL,
        '3354',
      );
      d.plot(ellipsePoints({ x: 9, y: 4 }, { x: 14, y: 11 }, true), '3326');
      d.fill((x, y) => y <= 2 && (x === 9 || x === 10 || x === 13 || x === 14), '3350');
      return d.build();
    },
  },
  {
    id: 'rainbow',
    name: 'Rainbow sky',
    description: 'Full-coverage diamond painting with a bright rainbow and clouds.',
    category: 'Diamond painting',
    type: 'diamond',
    difficulty: 'Easy',
    build() {
      const w = 60;
      const h = 36;
      const d = new Design(w, h);
      const bands = ['666', '740', '307', '702', '796', '552'];
      const cx = w / 2 - 0.5;
      const cy = h + 2;
      d.fill((x, y) => {
        const r = Math.hypot(x - cx, y - cy);
        return r >= 18 && r < 18 + bands.length * 3;
      }, '666');
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const r = Math.hypot(x - cx, y - cy);
          const band = Math.floor((18 + bands.length * 3 - r) / 3);
          if (r >= 18 && band >= 0 && band < bands.length) d.set(x, y, bands[band]);
        }
      }
      d.plot(ellipsePoints({ x: 3, y: 26 }, { x: 16, y: 33 }, true), 'B5200');
      d.plot(ellipsePoints({ x: 43, y: 26 }, { x: 56, y: 33 }, true), 'B5200');
      d.fill((x, y) => d.get(x, y) === EMPTY_CELL, '775');
      return d.build();
    },
  },
  {
    id: 'sunset',
    name: 'Sunset over the sea',
    description:
      'A paint-by-number scene with sky bands, sun, sea and hills - one number per region.',
    category: 'Paint by number',
    type: 'color_by_number',
    difficulty: 'Easy',
    build() {
      const w = 48;
      const h = 32;
      const d = new Design(w, h);
      const sky = ['3712', '3801', '971', '972'];
      d.fill((_, y) => y < 20, sky[0]);
      for (let y = 0; y < 20; y++) {
        const band = Math.min(sky.length - 1, Math.floor(y / 5));
        for (let x = 0; x < w; x++) d.set(x, y, sky[band]);
      }
      d.plot(ellipsePoints({ x: 17, y: 10 }, { x: 31, y: 24 }, true), '726');
      d.fill((_, y) => y >= 20, '798');
      d.fill((x, y) => y >= 20 && y % 3 === 1 && (x + y) % 7 < 3, '809');
      d.plot(ellipsePoints({ x: -10, y: 15 }, { x: 14, y: 31 }, true), '905');
      d.plot(ellipsePoints({ x: 36, y: 17 }, { x: 58, y: 33 }, true), '702');
      return d.build();
    },
  },
];

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  'Beginner',
  'Samplers',
  'Borders',
  'Gifts',
  'Seasonal',
  'Diamond painting',
  'Paint by number',
];

export function findTemplate(id: string): PatternTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
