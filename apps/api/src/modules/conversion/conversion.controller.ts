import { Controller, Get, NotImplementedException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Stub for M0: routes exist and are guarded/typed so the frontend can be
 * built against a stable contract, but real image conversion lands in M2
 * (see PLAN.md milestones). Until then every route reports 501.
 */
@Controller('conversions')
@UseGuards(JwtAuthGuard)
export class ConversionController {
  @Post()
  create(): never {
    throw new NotImplementedException('Image conversion ships in milestone M2');
  }

  @Get(':id')
  findOne(@Param('id') _id: string): never {
    throw new NotImplementedException('Image conversion ships in milestone M2');
  }
}
