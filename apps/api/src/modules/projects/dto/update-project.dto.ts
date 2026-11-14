import { IsOptional, IsString, MinLength } from 'class-validator';

import { UpdateProjectDto as UpdateProjectDtoShape } from '@hobbygrid/types';

export class UpdateProjectDto implements UpdateProjectDtoShape {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
