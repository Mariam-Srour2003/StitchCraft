import { IsString, MinLength } from 'class-validator';
import { CreateProjectDto as CreateProjectDtoShape } from '@stitchcraft/types';

export class CreateProjectDto implements CreateProjectDtoShape {
  @IsString()
  @MinLength(1)
  name!: string;
}
