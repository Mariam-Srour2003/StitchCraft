import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { BEAD_CATALOGUE_IDS } from '@stitchcraft/color';
import {
  DITHER_MODES,
  DitherMode,
  MAX_PATTERN_DIMENSION,
  PATTERN_TYPE_VALUES,
  PatternType,
} from '@stitchcraft/types';

/** Multipart fields for POST /conversions/analyze (the image is the `file` field). */
export class AnalyzeImageDto {
  @IsIn(PATTERN_TYPE_VALUES)
  targetType!: PatternType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PATTERN_DIMENSION)
  width!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PATTERN_DIMENSION)
  height!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  colorCount!: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enhance?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  cleanup?: boolean;

  @IsOptional()
  @IsIn(DITHER_MODES)
  dither?: DitherMode;

  @IsOptional()
  @IsIn(BEAD_CATALOGUE_IDS)
  beadCatalogueId?: string;
}
