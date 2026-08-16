import { DmcColor } from '@stitchcraft/types';
import raw from './dmc-colors.json';

/** The full seeded DMC thread color reference set (454 colors). See README.md for provenance. */
export const DMC_COLORS: readonly DmcColor[] = raw as DmcColor[];

const byCode = new Map(DMC_COLORS.map((c) => [c.code, c]));

export function findDmcByCode(code: string): DmcColor | undefined {
  return byCode.get(code);
}
