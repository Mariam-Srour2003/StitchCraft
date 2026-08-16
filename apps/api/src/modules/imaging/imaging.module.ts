import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './ai-provider';
import { ImagingService } from './imaging.service';
import { NullAiProvider } from './null-ai-provider';

/**
 * Deterministic image processing (resize, quantize, DMC-match, symbol
 * assignment via `sharp` + `@stitchcraft/color`), plus the `AiProvider` seam
 * for optional AI-assisted steps. Consumed by the `conversion` module.
 */
@Module({
  providers: [ImagingService, { provide: AI_PROVIDER, useClass: NullAiProvider }],
  exports: [ImagingService],
})
export class ImagingModule {}
