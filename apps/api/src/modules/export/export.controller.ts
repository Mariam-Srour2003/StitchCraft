import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ExportResponse } from '@stitchcraft/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExportService } from './export.service';

@Controller('exports')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post(':patternId')
  create(@CurrentUser() user: RequestUser, @Param('patternId') patternId: string): Promise<ExportResponse> {
    return this.exportService.generate(user.id, patternId);
  }
}
