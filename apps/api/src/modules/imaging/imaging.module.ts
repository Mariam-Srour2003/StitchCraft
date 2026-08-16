import { Module } from '@nestjs/common';

/**
 * Deterministic image processing (resize, quantize, DMC-match, chart/symbol
 * generation via `sharp` + `@stitchcraft/color`). No routes of its own -
 * consumed by the `conversion` and `export` modules starting in M2/M4.
 */
@Module({})
export class ImagingModule {}
