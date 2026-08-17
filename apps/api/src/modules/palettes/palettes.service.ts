import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DMC_COLORS } from '@stitchcraft/color';
import { DmcColor, Palette, PaginatedResponse } from '@stitchcraft/types';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaletteDto } from './dto/create-palette.dto';
import { DmcQueryDto } from './dto/dmc-query.dto';
import { toPaletteDto } from './palettes.mapper';

const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class PalettesService {
  constructor(private readonly prisma: PrismaService) {}

  findDmc(query: DmcQueryDto): PaginatedResponse<DmcColor> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const search = query.search?.trim().toLowerCase();
    const filtered = search
      ? DMC_COLORS.filter(
          (c) => c.name.toLowerCase().includes(search) || c.code.toLowerCase().includes(search),
        )
      : DMC_COLORS;

    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async findAllForUser(userId: string): Promise<Palette[]> {
    const palettes = await this.prisma.palette.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
    });
    return palettes.map(toPaletteDto);
  }

  async create(userId: string, dto: CreatePaletteDto): Promise<Palette> {
    const palette = await this.prisma.palette.create({
      data: {
        ownerId: userId,
        kind: 'custom',
        name: dto.name,
        entries: dto.entries.map((entry, index) => ({ ...entry, index })) as unknown as object[],
      },
    });
    return toPaletteDto(palette);
  }

  async remove(userId: string, id: string): Promise<void> {
    const palette = await this.prisma.palette.findUnique({ where: { id } });
    if (!palette) throw new NotFoundException('Palette not found');
    if (palette.ownerId !== userId) throw new ForbiddenException('You do not have access to this palette');

    await this.prisma.palette.delete({ where: { id } });
  }
}
