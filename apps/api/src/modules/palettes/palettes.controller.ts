import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { DmcColor, PaginatedResponse, Palette } from '@stitchcraft/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePaletteDto } from './dto/create-palette.dto';
import { DmcQueryDto } from './dto/dmc-query.dto';
import { PalettesService } from './palettes.service';

@Controller('palettes')
export class PalettesController {
  constructor(private readonly palettes: PalettesService) {}

  @Get('dmc')
  findDmc(@Query() query: DmcQueryDto): PaginatedResponse<DmcColor> {
    return this.palettes.findDmc(query);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: RequestUser): Promise<Palette[]> {
    return this.palettes.findAllForUser(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePaletteDto): Promise<Palette> {
    return this.palettes.create(user.id, dto);
  }
}
