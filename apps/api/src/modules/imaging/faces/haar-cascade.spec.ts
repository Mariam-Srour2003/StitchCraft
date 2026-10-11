import { readFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

import cascadeJson from './frontalface-alt2.json';
import type { HaarCascade } from './haar-cascade';
import { detectMultiScale, groupBoxes, resizeGray, toGray } from './haar-cascade';

const cascade = cascadeJson as unknown as HaarCascade;

async function grayFixture(name: string) {
  const { data, info } = await sharp(readFileSync(join(__dirname, '__fixtures__', name)))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return toGray(data, info.width, info.height, info.channels);
}

describe('haar cascade face detector', () => {
  it('matches OpenCV on the same pixels', async () => {
    const faces = detectMultiScale(cascade, await grayFixture('astronaut-256.png'));
    const boxes = faces.map((f) => [f.x, f.y, f.width, f.height]);
    // cv2: [[88, 33, 49, 49], [142, 63, 64, 64]] - the 1px difference on the
    // second box is rounding in the averaged cluster.
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toEqual([88, 33, 49, 49]);
    boxes[1].forEach((v, i) => expect(Math.abs(v - [142, 63, 64, 64][i])).toBeLessThanOrEqual(1));
  });

  it('finds nothing in flat or random images', () => {
    const flat = { width: 120, height: 90, data: new Uint8Array(120 * 90).fill(128) };
    expect(detectMultiScale(cascade, flat)).toEqual([]);
    let seed = 7;
    const noise = {
      width: 120,
      height: 90,
      data: Uint8Array.from(
        { length: 120 * 90 },
        () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % 256,
      ),
    };
    expect(detectMultiScale(cascade, noise)).toEqual([]);
  });

  it('respects minSize', async () => {
    const faces = detectMultiScale(cascade, await grayFixture('astronaut-256.png'), {
      minSize: 60,
    });
    expect(faces.every((f) => f.width >= 60)).toBe(true);
  });

  it('converts to gray with Rec. 601 weights', () => {
    const gray = toGray(Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255]), 3, 1, 3);
    expect([...gray.data]).toEqual([76, 150, 29]);
  });

  it('resizes bilinearly (same size is identity, halving averages pairs)', () => {
    const img = { width: 4, height: 1, data: Uint8Array.from([0, 100, 200, 250]) };
    expect([...resizeGray(img, 4, 1).data]).toEqual([0, 100, 200, 250]);
    expect([...resizeGray(img, 2, 1).data]).toEqual([50, 225]);
  });

  describe('groupBoxes', () => {
    const box = (x: number, y: number, size = 40) => ({ x, y, width: size, height: size });

    it('merges overlapping hits and averages them', () => {
      const hits = [box(10, 10), box(12, 11), box(11, 9), box(9, 10)];
      expect(groupBoxes(hits, 3)).toEqual([{ x: 11, y: 10, width: 40, height: 40 }]);
    });

    it('drops clusters with too few hits', () => {
      expect(groupBoxes([box(10, 10), box(11, 10)], 3)).toEqual([]);
    });

    it('keeps separate faces separate', () => {
      const hits = [0, 1, 2, 3].flatMap((i) => [box(10 + i, 10), box(200 + i, 10)]);
      expect(groupBoxes(hits, 3)).toHaveLength(2);
    });
  });
});
