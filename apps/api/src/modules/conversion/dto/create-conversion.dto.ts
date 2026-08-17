import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PatternType } from '@stitchcraft/types';

const PATTERN_TYPES: PatternType[] = ['cross_stitch', 'color_by_number', 'diamond'];

/**
 * Wire DTO for the multipart POST /conversions request. Deliberately
 * separate from @stitchcraft/types' CreateConversionDto: that shape assumes
 * a JSON body with a pre-uploaded `sourceImageRef`, whereas this endpoint
 * takes the source image itself as the multipart `file` field, and every
 * other field arrives as a form-data string that needs coercion.
 */
export class CreateConversionDto {
  @IsString()
  projectId!: string;

  @IsIn(PATTERN_TYPES)
  targetType!: PatternType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  width!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
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
}
