import sharp from 'sharp';

import { decodeGrid } from '@stitchcraft/types';

import { AiProvider } from './ai-provider';
import { ImagingService } from './imaging.service';

const noAi: AiProvider = {
  isConfigured: () => false,
  removeBackground: jest.fn(),
  upscale: jest.fn(),
};

/** A width x height PNG, left half red and right half blue. */
async function splitImage(width: number, height: number, orientation?: number): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      if (x < width / 2) data.set([220, 20, 20], o);
      else data.set([20, 20, 220], o);
    }
  }
  let image = sharp(data, { raw: { width, height, channels: 3 } });
  if (orientation) image = image.withMetadata({ orientation }).jpeg({ quality: 95 });
  else image = image.png();
  return image.toBuffer();
}

describe('ImagingService', () => {
  const service = new ImagingService(noAi);

  it('converts a two-colour image to a two-colour pattern', async () => {
    const result = await service.convertImageToGrid(await splitImage(40, 40), {
      width: 10,
      height: 10,
      colorCount: 4,
    });
    expect(result.palette).toHaveLength(2);
    const rows = decodeGrid(result.grid, 10);
    expect(rows[5][0]).not.toBe(rows[5][9]);
  });

  it('applies EXIF orientation, so a phone photo stored sideways converts upright', async () => {
    // Stored as left=red/right=blue, tagged "rotate 90 clockwise" (6): the
    // upright picture is red on top, blue at the bottom.
    const result = await service.convertImageToGrid(await splitImage(40, 40, 6), {
      width: 10,
      height: 10,
      colorCount: 2,
    });
    const rows = decodeGrid(result.grid, 10);
    expect(rows[0][0]).toBe(rows[0][9]); // top row is one colour
    expect(rows[0][0]).not.toBe(rows[9][0]); // top and bottom differ
  });

  it('runs the enhance and cleanup steps end to end', async () => {
    const result = await service.convertImageToGrid(await splitImage(200, 200), {
      width: 20,
      height: 20,
      colorCount: 6,
      enhance: true,
      cleanup: true,
    });
    expect(result.cleanup).toBeDefined();
    expect(result.palette.length).toBeGreaterThanOrEqual(2);
  });
});
