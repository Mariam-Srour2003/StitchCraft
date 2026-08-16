import { Controller, NotImplementedException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/** Stub for M0; tiled PDF/PNG/SVG/materials-list export ships in M4 (see PLAN.md). */
@Controller('exports')
@UseGuards(JwtAuthGuard)
export class ExportController {
  @Post(':patternId')
  create(@Param('patternId') _patternId: string): never {
    throw new NotImplementedException('Pattern export ships in milestone M4');
  }
}
