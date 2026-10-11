import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { MAX_PATTERN_DIMENSION, PatternType } from '@stitchcraft/types';

const PATTERN_TYPES: PatternType[] = ['cross_stitch', 'color_by_number', 'diamond'];

/** Multipart fields for POST /conversions/analyze (the image is the `file` field). */
export class AnalyzeImageDto {
  @IsIn(PATTERN_TYPES)
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
}
