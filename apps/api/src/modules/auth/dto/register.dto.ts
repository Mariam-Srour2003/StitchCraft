import { IsEmail, IsString, MinLength } from 'class-validator';

import { RegisterDto as RegisterDtoShape } from '@hobbygrid/types';

export class RegisterDto implements RegisterDtoShape {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}
