import { Module } from '@nestjs/common';
import { ConversionController } from './conversion.controller';

@Module({
  controllers: [ConversionController],
})
export class ConversionModule {}
