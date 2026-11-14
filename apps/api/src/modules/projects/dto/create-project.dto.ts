import { IsString, MinLength } from 'class-validator';

import { CreateProjectDto as CreateProjectDtoShape } from '@hobbygrid/types';

export class CreateProjectDto implements CreateProjectDtoShape {
  @IsString()
  @MinLength(1)
  name!: string;
}
