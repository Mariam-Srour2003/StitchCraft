import { srgbToLab } from '../space/srgb-lab';
import { planRareColorMerge } from './merge-rare-colors';

const lab = (r: number, g: number, b: number) => srgbToLab({ r, g, b });

describe('planRareColorMerge', () => {
  const red = lab(220, 20, 30);
  const darkRed = lab(180, 10, 20);
  const blue = lab(20, 40, 220);
  const white = lab(255, 255, 255);

  it('folds a rare colour into the perceptually closest common one', () => {
    expect(planRareColorMerge([red, blue, darkRed], [100, 100, 3], 10)).toEqual([0, 1, 0]);
  });

  it('never merges into another rare colour', () => {
    // darkRed is closest to red, but red is itself rare, so it goes to blue/white
    const remap = planRareColorMerge([red, blue, darkRed, white], [2, 50, 3, 50], 10);
    expect(remap[0]).not.toBe(2);
    expect(remap[2]).not.toBe(0);
    expect([1, 3]).toContain(remap[0]);
  });

  it('leaves unused colours and common colours alone', () => {
    expect(planRareColorMerge([red, blue, white], [0, 40, 40], 10)).toEqual([0, 1, 2]);
  });

  it('does nothing when every colour is rare', () => {
    expect(planRareColorMerge([red, blue], [3, 4], 10)).toEqual([0, 1]);
  });
});
