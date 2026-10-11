import type { RgbaImage } from './image-ops';
import {
  adjust,
  applyEdits,
  boxFromPoints,
  boxFromPointsWithAspect,
  boxToPixels,
  centeredBox,
  composeCrop,
  crop,
  downscale,
  editedAspect,
  flip,
  hasEdits,
  moveBox,
  NO_EDITS,
  rotate,
} from './image-ops';

/** A w x h image whose red channel is the pixel's index, so positions are easy to check. */
function indexed(width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = i;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}
const reds = (img: RgbaImage) => {
  const rows: number[][] = [];
  for (let y = 0; y < img.height; y++) {
    rows.push(Array.from({ length: img.width }, (_, x) => img.data[(y * img.width + x) * 4]));
  }
  return rows;
};
const solid = (r: number, g: number, b: number, width = 2, height = 1): RgbaImage => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([r, g, b, 255], i * 4);
  return { width, height, data };
};

// 3x2 image:   0 1 2
//              3 4 5
describe('geometry', () => {
  const img = indexed(3, 2);

  it('rotates clockwise', () => {
    expect(reds(rotate(img, 90))).toEqual([
      [3, 0],
      [4, 1],
      [5, 2],
    ]);
    expect(reds(rotate(img, 180))).toEqual([
      [5, 4, 3],
      [2, 1, 0],
    ]);
    expect(reds(rotate(img, 270))).toEqual([
      [2, 5],
      [1, 4],
      [0, 3],
    ]);
    expect(rotate(img, 0)).toBe(img);
  });

  it('four quarter turns is the identity', () => {
    let out = img;
    for (let i = 0; i < 4; i++) out = rotate(out, 90);
    expect(reds(out)).toEqual(reds(img));
  });

  it('flips', () => {
    expect(reds(flip(img, true, false))).toEqual([
      [2, 1, 0],
      [5, 4, 3],
    ]);
    expect(reds(flip(img, false, true))).toEqual([
      [3, 4, 5],
      [0, 1, 2],
    ]);
    expect(flip(img, false, false)).toBe(img);
  });

  it('crops by relative box', () => {
    expect(reds(crop(img, { x: 1 / 3, y: 0, width: 2 / 3, height: 1 }))).toEqual([
      [1, 2],
      [4, 5],
    ]);
    expect(reds(crop(img, { x: 0, y: 0.5, width: 1, height: 0.5 }))).toEqual([[3, 4, 5]]);
    expect(crop(img, null)).toBe(img);
  });

  it('never crops to nothing or outside the image', () => {
    expect(boxToPixels({ x: 0.99, y: 0.99, width: 0, height: 0 }, 3, 2)).toEqual({
      x: 2,
      y: 1,
      width: 1,
      height: 1,
    });
  });

  it('applies rotation, then flip, then crop', () => {
    const edits = {
      ...NO_EDITS,
      rotation: 90 as const,
      flipH: true,
      crop: { x: 0, y: 0, width: 1, height: 1 / 3 },
    };
    // rotate 90 -> [[3,0],[4,1],[5,2]], flipH -> [[0,3],[1,4],[2,5]], top third -> [[0,3]]
    expect(reds(applyEdits(img, edits))).toEqual([[0, 3]]);
  });

  it('reports the edited aspect ratio', () => {
    expect(editedAspect(300, 200, NO_EDITS)).toBeCloseTo(1.5);
    expect(editedAspect(300, 200, { ...NO_EDITS, rotation: 90 })).toBeCloseTo(2 / 3);
    expect(
      editedAspect(300, 200, { ...NO_EDITS, crop: { x: 0, y: 0, width: 0.5, height: 1 } }),
    ).toBeCloseTo(0.75);
  });
});

describe('adjust', () => {
  it('returns the same image when nothing changes', () => {
    const img = solid(10, 20, 30);
    expect(adjust(img, { brightness: 0, contrast: 0, saturation: 0 })).toBe(img);
  });

  it('brightens and darkens', () => {
    const up = adjust(solid(100, 100, 100), { brightness: 50, contrast: 0, saturation: 0 });
    const down = adjust(solid(100, 100, 100), { brightness: -50, contrast: 0, saturation: 0 });
    expect(up.data[0]).toBe(164);
    expect(down.data[0]).toBe(36);
  });

  it('contrast pushes values away from mid-grey', () => {
    const img = solid(0, 0, 0, 2, 1);
    img.data.set([100, 100, 100, 255, 160, 160, 160, 255]);
    const out = adjust(img, { brightness: 0, contrast: 50, saturation: 0 });
    expect(out.data[0]).toBeLessThan(100);
    expect(out.data[4]).toBeGreaterThan(160);
  });

  it('saturation -100 gives grey, and alpha is kept', () => {
    const img = solid(200, 50, 50);
    img.data[3] = 77;
    const out = adjust(img, { brightness: 0, contrast: 0, saturation: -100 });
    expect(out.data[0]).toBe(out.data[1]);
    expect(out.data[1]).toBe(out.data[2]);
    expect(out.data[3]).toBe(77);
  });

  it('saturation +100 moves channels away from grey', () => {
    const out = adjust(solid(150, 100, 100), { brightness: 0, contrast: 0, saturation: 100 });
    expect(out.data[0]).toBeGreaterThan(150);
    expect(out.data[1]).toBeLessThan(100);
  });
});

describe('downscale', () => {
  it('leaves small images alone', () => {
    const img = indexed(3, 2);
    expect(downscale(img, 10)).toBe(img);
  });

  it('averages blocks of pixels', () => {
    const img = solid(0, 0, 0, 4, 2);
    // left half 200, right half 0
    for (const i of [0, 1, 4, 5]) img.data[i * 4] = 200;
    const out = downscale(img, 2);
    expect([out.width, out.height]).toEqual([2, 1]);
    expect([out.data[0], out.data[4]]).toEqual([200, 0]);
  });
});

describe('crop boxes', () => {
  it('builds a box from a drag in any direction, clamped to the photo', () => {
    const box = boxFromPoints(0.8, 0.9, 0.2, 0.1);
    expect([box.x, box.y, box.width, box.height].map((v) => +v.toFixed(6))).toEqual([
      0.2, 0.1, 0.6, 0.8,
    ]);
    expect(boxFromPoints(0.5, 0.5, 1.4, -1)).toEqual({ x: 0.5, y: 0, width: 0.5, height: 0.5 });
  });

  it('keeps a fixed shape while dragging, and stays inside the photo', () => {
    // square box on a 2:1 photo: relative width is half the relative height
    const box = boxFromPointsWithAspect(0.1, 0.1, 0.5, 0.3, 1, 2);
    expect((box.width * 2) / box.height).toBeCloseTo(1);
    expect(box.x + box.width).toBeLessThanOrEqual(1);
    expect(box.y + box.height).toBeLessThanOrEqual(1);
    const edge = boxFromPointsWithAspect(0.9, 0.9, 2, 2, 1, 1);
    expect(edge.x + edge.width).toBeCloseTo(1);
    expect(edge.width).toBeCloseTo(edge.height);
  });

  it('dragging up-left anchors at the starting corner', () => {
    const box = boxFromPointsWithAspect(0.6, 0.6, 0.2, 0.4, 1, 1);
    expect(box.x + box.width).toBeCloseTo(0.6);
    expect(box.y + box.height).toBeCloseTo(0.6);
  });

  it('moves a box without leaving the photo', () => {
    expect(moveBox({ x: 0.5, y: 0.5, width: 0.4, height: 0.4 }, 0.5, -0.9)).toEqual({
      x: 0.6,
      y: 0,
      width: 0.4,
      height: 0.4,
    });
  });

  it('centres the largest box of a shape', () => {
    expect(centeredBox(1, 2)).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(centeredBox(2, 1)).toEqual({ x: 0, y: 0.25, width: 1, height: 0.5 });
  });

  it('composes a crop made on an already-cropped photo', () => {
    const outer = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };
    expect(composeCrop(outer, { x: 0.5, y: 0, width: 0.5, height: 0.5 })).toEqual({
      x: 0.75,
      y: 0.5,
      width: 0.25,
      height: 0.25,
    });
    const inner = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
    expect(composeCrop(null, inner)).toBe(inner);
  });
});

it('hasEdits', () => {
  expect(hasEdits(NO_EDITS)).toBe(false);
  expect(hasEdits({ ...NO_EDITS, flipV: true })).toBe(true);
  expect(hasEdits({ ...NO_EDITS, adjust: { brightness: 0, contrast: 5, saturation: 0 } })).toBe(
    true,
  );
});
