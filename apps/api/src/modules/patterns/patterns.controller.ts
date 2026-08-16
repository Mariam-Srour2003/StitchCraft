import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Pattern } from '@stitchcraft/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePatternDto } from './dto/create-pattern.dto';
import { ListPatternsDto } from './dto/list-patterns.dto';
import { UpdatePatternDto } from './dto/update-pattern.dto';
import { PatternsService } from './patterns.service';

@Controller('patterns')
@UseGuards(JwtAuthGuard)
export class PatternsController {
  constructor(private readonly patterns: PatternsService) {}

  @Get()
  findAllForProject(@CurrentUser() user: RequestUser, @Query() query: ListPatternsDto): Promise<Pattern[]> {
    return this.patterns.findAllForProject(user.id, query.projectId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<Pattern> {
    return this.patterns.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePatternDto): Promise<Pattern> {
    return this.patterns.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdatePatternDto,
  ): Promise<Pattern> {
    return this.patterns.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.patterns.remove(user.id, id);
  }
}
