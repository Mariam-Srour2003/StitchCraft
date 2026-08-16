import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ImagingModule } from '../imaging/imaging.module';
import { CONVERSIONS_QUEUE } from './conversion-job-data';
import { ConversionController } from './conversion.controller';
import { ConversionsGateway } from './conversion.gateway';
import { ConversionsProcessor } from './conversion.processor';
import { ConversionsService } from './conversion.service';

@Module({
  imports: [BullModule.registerQueue({ name: CONVERSIONS_QUEUE }), ImagingModule],
  controllers: [ConversionController],
  providers: [ConversionsService, ConversionsProcessor, ConversionsGateway],
})
export class ConversionModule {}
