import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai-provider';
import { HttpAiProvider } from './http-ai-provider';
import { ImagingService } from './imaging.service';
import { NullAiProvider } from './null-ai-provider';

/**
 * Deterministic image processing (resize, quantize, DMC-match, symbol
 * assignment via `sharp` + `@stitchcraft/color`), plus the `AiProvider` seam
 * for optional AI-assisted steps. Consumed by the `conversion` module.
 *
 * AI_PROVIDER resolves to HttpAiProvider (talks to services/ai) when
 * AI_SERVICE_URL is set, and NullAiProvider (every step is a no-op
 * passthrough) otherwise - the app works fully either way, per PLAN.md's
 * "must work with zero AI configuration" requirement.
 */
@Module({
  providers: [
    ImagingService,
    HttpAiProvider,
    NullAiProvider,
    {
      provide: AI_PROVIDER,
      useFactory: (config: ConfigService, http: HttpAiProvider, none: NullAiProvider) =>
        config.get<string>('AI_SERVICE_URL') ? http : none,
      inject: [ConfigService, HttpAiProvider, NullAiProvider],
    },
  ],
  exports: [ImagingService],
})
export class ImagingModule {}
