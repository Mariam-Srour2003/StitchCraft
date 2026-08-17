import type { EncodedRow } from '../models/grid';
import type { PaletteEntry } from '../models/palette.model';
import type { PatternMeta, PatternType } from '../models/pattern.model';

export interface CreatePatternDto {
  projectId: string;
  name: string;
  type: PatternType;
  width: number;
  height: number;
  palette?: PaletteEntry[];
  meta?: Partial<PatternMeta>;
}

export interface UpdatePatternDto {
  name?: string;
  width?: number;
  height?: number;
  palette?: PaletteEntry[];
  grid?: EncodedRow[];
  meta?: Partial<PatternMeta>;
}
