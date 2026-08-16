import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { CreatePatternDto as CreatePatternDtoShape, PatternType } from '@stitchcraft/types';

const PATTERN_TYPES: PatternType[] = ['cross_stitch', 'color_by_number', 'diamond'];

export class CreatePatternDto implements CreatePatternDtoShape {
  @IsString()
  projectId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(PATTERN_TYPES)
  type!: PatternType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  width!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  height!: number;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  palette?: CreatePatternDtoShape['palette'];

  @IsOptional()
  @IsObject()
  meta?: CreatePatternDtoShape['meta'];
}
