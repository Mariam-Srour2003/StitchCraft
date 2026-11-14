import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

import { UpdatePatternDto as UpdatePatternDtoShape } from '@stitchcraft/types';
import { MAX_PATTERN_DIMENSION } from '@stitchcraft/types';

export class UpdatePatternDto implements UpdatePatternDtoShape {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PATTERN_DIMENSION)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PATTERN_DIMENSION)
  height?: number;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  palette?: UpdatePatternDtoShape['palette'];

  @IsOptional()
  @IsArray()
  grid?: UpdatePatternDtoShape['grid'];

  @IsOptional()
  @IsObject()
  meta?: UpdatePatternDtoShape['meta'];
}
