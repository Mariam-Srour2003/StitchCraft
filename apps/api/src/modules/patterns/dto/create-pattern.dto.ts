import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

import {
  CreatePatternDto as CreatePatternDtoShape,
  PATTERN_TYPE_VALUES,
  PatternType,
} from '@hobbygrid/types';
import { MAX_PATTERN_DIMENSION } from '@hobbygrid/types';

export class CreatePatternDto implements CreatePatternDtoShape {
  @IsString()
  projectId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(PATTERN_TYPE_VALUES)
  type!: PatternType;

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

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  palette?: CreatePatternDtoShape['palette'];

  @IsOptional()
  @IsObject()
  meta?: CreatePatternDtoShape['meta'];
}
