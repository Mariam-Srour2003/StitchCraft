/**
 * Conversion quality benchmark: runs the real conversion pipeline
 * (stitchPixels + buildGridFromPixels) over a fixed image set and scores
 * every result, so a change to the engine can show before/after numbers.
 *
 *   pnpm nx run api:bench
 *
 * Settings (environment variables): BENCH_WIDTH (stitches wide, default 100),
 * BENCH_COLORS (default 30), BENCH_PREVIEW=1 to also write a PNG of every
 * result to apps/api/bench/out/. Results always go to out/results.json.
 *
 * Runs under Jest only because Jest is the TypeScript runner the API already
 * has; this is not a test and never fails on quality.
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

import { decodeGrid, EMPTY_CELL } from '@stitchcraft/types';

import {
  buildGridFromPixels,
  type BuildGridOptions,
  conversionCatalogue,
} from '../src/modules/imaging/build-grid-from-pixels';
import { stitchPixels } from '../src/modules/imaging/stitch-pixels';
import { measurePattern, type PatternMetrics } from './metrics';
import { loadSampleImages } from './sample-images';

interface Variant {
  name: string;
  options: BuildGridOptions;
}

/** Every option combination worth comparing. Add new engine settings here. */
const VARIANTS: Variant[] = [
  { name: 'default', options: {} },
  { name: 'cleanup', options: { cleanup: true } },
  { name: 'blend light', options: { dither: 'light' } },
  { name: 'blend full', options: { dither: 'full' } },
  { name: 'blend light + cleanup', options: { dither: 'light', cleanup: true } },
  {
    name: 'Hama Midi beads',
    options: { catalogue: conversionCatalogue('fuse_bead', 'hama-midi') },
  },
  {
    name: 'Hama Midi beads, blend light',
    options: { catalogue: conversionCatalogue('fuse_bead', 'hama-midi'), dither: 'light' },
  },
];

const WIDTH = Number(process.env['BENCH_WIDTH'] ?? 100);
const COLORS = Number(process.env['BENCH_COLORS'] ?? 30);
const PREVIEW = process.env['BENCH_PREVIEW'] === '1';
const OUT_DIR = path.join(__dirname, 'out');

interface Row extends PatternMetrics {
  image: string;
  kind: string;
  variant: string;
  requested: number;
  ms: number;
}

jest.setTimeout(30 * 60 * 1000);

test('conversion benchmark', async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows: Row[] = [];

  for (const image of loadSampleImages()) {
    const meta = await sharp(image.buffer).metadata();
    const height = Math.max(1, Math.round((WIDTH * (meta.height ?? 1)) / (meta.width ?? 1)));
    const pixels = await stitchPixels(image.buffer, WIDTH, height);

    for (const variant of VARIANTS) {
      const started = performance.now();
      const result = buildGridFromPixels(pixels, WIDTH, height, COLORS, variant.options);
      const ms = performance.now() - started;
      rows.push({
        image: image.name,
        kind: image.kind,
        variant: variant.name,
        requested: COLORS,
        ms,
        ...measurePattern(pixels, WIDTH, height, result.palette, result.grid),
      });
      if (PREVIEW) {
        await writePreview(
          result,
          WIDTH,
          height,
          path.join(OUT_DIR, `${image.name}-${variant.name}.png`),
        );
      }
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(rows, null, 2));
  process.stdout.write(`\n${report(rows)}\n`);
});

function report(rows: Row[]): string {
  const header = `Conversion benchmark: ${WIDTH} stitches wide, ${COLORS} colours requested, ${
    new Set(rows.map((r) => r.image)).size
  } images\n`;
  const table = (title: string, subset: Row[]) => {
    const lines = [
      `\n${title}\n`,
      '| Variant | Colours (of requested) | Mean ΔE | View ΔE | Confetti % | Runs | ms |',
      '| --- | --- | --- | --- | --- | --- | --- |',
    ];
    for (const variant of VARIANTS) {
      const r = subset.filter((row) => row.variant === variant.name);
      if (!r.length) continue;
      const avg = (k: keyof Row) => r.reduce((s, row) => s + (row[k] as number), 0) / r.length;
      lines.push(
        `| ${variant.name} | ${avg('colours').toFixed(1)} of ${COLORS} | ${avg('meanDE').toFixed(2)} | ${avg(
          'viewDE',
        ).toFixed(
          2,
        )} | ${avg('confettiPct').toFixed(1)} | ${Math.round(avg('runs'))} | ${Math.round(avg('ms'))} |`,
      );
    }
    return lines.join('\n');
  };
  const photos = rows.filter((r) => r.kind === 'photo');
  const drawn = rows.filter((r) => r.kind !== 'photo');
  return (
    header +
    table('Photos (average)', photos) +
    '\n' +
    table('Gradients, flat colours and pixel art (average)', drawn)
  );
}

async function writePreview(
  result: ReturnType<typeof buildGridFromPixels>,
  width: number,
  height: number,
  file: string,
): Promise<void> {
  const rows = decodeGrid(result.grid, width);
  const raw = Buffer.alloc(width * height * 3, 255);
  rows.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v === EMPTY_CELL) return;
      const { r, g, b } = result.palette[v].color.rgb;
      raw.set([r, g, b], (y * width + x) * 3);
    }),
  );
  await sharp(raw, { raw: { width, height, channels: 3 } })
    .resize(width * 5, height * 5, { kernel: 'nearest' })
    .png()
    .toFile(file);
}
