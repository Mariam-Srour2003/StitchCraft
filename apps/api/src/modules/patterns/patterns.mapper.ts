import type { Pattern as PrismaPattern } from '@prisma/client';
import type {
  EncodedRow,
  Pattern,
  PaletteEntry,
  PatternMeta,
  PatternType,
} from '@stitchcraft/types';

export function toPatternDto(pattern: PrismaPattern): Pattern {
  return {
    id: pattern.id,
    projectId: pattern.projectId,
    name: pattern.name,
    type: pattern.type as PatternType,
    width: pattern.width,
    height: pattern.height,
    palette: pattern.palette as unknown as PaletteEntry[],
    grid: pattern.grid as unknown as EncodedRow[],
    meta: pattern.meta as unknown as PatternMeta,
    createdAt: pattern.createdAt.toISOString(),
    updatedAt: pattern.updatedAt.toISOString(),
  };
}
