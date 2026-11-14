import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { BEAD_CATALOGUE_IDS } from '@hobbygrid/color';
import {
  DITHER_MODES,
  DitherMode,
  MAX_PATTERN_DIMENSION,
  PATTERN_TYPE_VALUES,
  PatternType,
} from '@hobbygrid/types';

/**
 * Wire DTO for the multipart POST /conversions request. Deliberately
 * separate from @hobbygrid/types' CreateConversionDto: that shape assumes
 * a JSON body with a pre-uploaded `sourceImageRef`, whereas this endpoint
 * takes the source image itself as the multipart `file` field, and every
 * other field arrives as a form-data string that needs coercion.
 */
export class CreateConversionDto {
  @IsString()
  projectId!: string;

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
  useAiBackgroundRemoval?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  useAiUpscale?: boolean;

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
