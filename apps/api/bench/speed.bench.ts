/**
 * Conversion speed at small, medium and the largest allowed pattern sizes,
 * split by stage. Part of `pnpm nx run api:bench`; prints timings only.
 */
import sharp from 'sharp';

import {
  DMC_COLORS,
  fillPalette,
  kMeansQuantize,
  labHistogram,
  nearestDmc,
  srgbToLab,
} from '@stitchcraft/color';

import { buildGridFromPixels } from '../src/modules/imaging/build-grid-from-pixels';
import { stitchPixels } from '../src/modules/imaging/stitch-pixels';
import { loadSampleImages } from './sample-images';

const SIZES: ReadonlyArray<readonly [width: number, colours: number]> = [
  [100, 30],
  [300, 60],
  [500, 100],
];

jest.setTimeout(10 * 60 * 1000);

test('conversion speed', async () => {
  const image = loadSampleImages().find((i) => i.name === 'coffee');
  if (!image) throw new Error('coffee.jpg is missing from the benchmark images');
  const meta = await sharp(image.buffer).metadata();
  const lines = [
    '\nConversion speed (coffee photo)\n',
    '| Size | Colours | k-means ms | Top-up ms | Whole conversion ms | With cleanup + light blend ms |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const [width, colours] of SIZES) {
    const height = Math.round((width * (meta.height ?? 1)) / (meta.width ?? 1));
    const pixels = await stitchPixels(image.buffer, width, height);
    const time = (fn: () => unknown) => {
      const started = performance.now();
      fn();
      return Math.round(performance.now() - started);
    };
    let centres: ReturnType<typeof kMeansQuantize> = [];
    const kMeansMs = time(() => (centres = kMeansQuantize(pixels, colours)));
    const topUpMs = time(() => {
      const snapped = [...new Set(centres.map((c) => nearestDmc(c, DMC_COLORS).color))];
      fillPalette(labHistogram(pixels, srgbToLab), snapped, DMC_COLORS, colours);
    });
    const wholeMs = time(() => buildGridFromPixels(pixels, width, height, colours));
    const extrasMs = time(() =>
      buildGridFromPixels(pixels, width, height, colours, { cleanup: true, dither: 'light' }),
    );
    lines.push(
      `| ${width}×${height} | ${colours} | ${kMeansMs} | ${topUpMs} | ${wholeMs} | ${extrasMs} |`,
    );
  }
  process.stdout.write(`${lines.join('\n')}\n`);
});
