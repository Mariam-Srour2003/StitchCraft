import { IsString } from 'class-validator';
import { RefreshTokenDto as RefreshTokenDtoShape } from '@stitchcraft/types';

export class RefreshTokenDto implements RefreshTokenDtoShape {
  @IsString()
  refreshToken!: string;
}
