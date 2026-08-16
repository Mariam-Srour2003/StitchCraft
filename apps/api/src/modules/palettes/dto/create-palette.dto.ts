import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreatePaletteDto as CreatePaletteDtoShape, CustomColor } from '@stitchcraft/types';

class RgbInput {
  @IsInt()
  @Min(0)
  r!: number;

  @IsInt()
  @Min(0)
  g!: number;

  @IsInt()
  @Min(0)
  b!: number;
}

class CustomColorInput implements CustomColor {
  @IsHexColor()
  hex!: string;

  @ValidateNested()
  @Type(() => RgbInput)
  rgb!: RgbInput;

  @IsOptional()
  @IsString()
  label?: string;
}

class PaletteEntryInput {
  @ValidateNested()
  @Type(() => CustomColorInput)
  color!: CustomColor;

  @IsString()
  symbol!: string;
}

export class CreatePaletteDto implements CreatePaletteDtoShape {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaletteEntryInput)
  entries!: CreatePaletteDtoShape['entries'];
}
