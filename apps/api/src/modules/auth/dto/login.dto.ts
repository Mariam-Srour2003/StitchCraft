import { IsEmail, IsString } from 'class-validator';
import { LoginDto as LoginDtoShape } from '@stitchcraft/types';

export class LoginDto implements LoginDtoShape {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
