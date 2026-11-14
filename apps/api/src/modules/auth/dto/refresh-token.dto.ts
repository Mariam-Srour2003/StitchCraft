import { IsString } from 'class-validator';

import { RefreshTokenDto as RefreshTokenDtoShape } from '@hobbygrid/types';

export class RefreshTokenDto implements RefreshTokenDtoShape {
  @IsString()
  refreshToken!: string;
}
