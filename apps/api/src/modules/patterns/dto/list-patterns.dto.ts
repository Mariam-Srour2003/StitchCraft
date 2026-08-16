import { IsString } from 'class-validator';

export class ListPatternsDto {
  @IsString()
  projectId!: string;
}
