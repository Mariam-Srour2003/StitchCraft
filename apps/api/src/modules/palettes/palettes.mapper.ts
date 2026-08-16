import { Palette as PrismaPalette } from '@prisma/client';
import { Palette, PaletteEntry } from '@stitchcraft/types';

export function toPaletteDto(palette: PrismaPalette): Palette {
  return {
    id: palette.id,
    ownerId: palette.ownerId,
    kind: palette.kind,
    name: palette.name,
    entries: palette.entries as unknown as PaletteEntry[],
    createdAt: palette.createdAt.toISOString(),
    updatedAt: palette.updatedAt.toISOString(),
  };
}
