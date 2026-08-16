import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { encodeGrid, Pattern } from '@stitchcraft/types';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatternDto } from './dto/create-pattern.dto';
import { UpdatePatternDto } from './dto/update-pattern.dto';
import { toPatternDto } from './patterns.mapper';

@Injectable()
export class PatternsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(userId: string, id: string): Promise<Pattern> {
    const pattern = await this.getOwned(userId, id);
    return toPatternDto(pattern);
  }

  async create(userId: string, dto: CreatePatternDto): Promise<Pattern> {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('You do not have access to this project');

    const blankGrid = encodeGrid(
      Array.from({ length: dto.height }, () => new Array(dto.width).fill(null)),
    );

    const pattern = await this.prisma.pattern.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        type: dto.type,
        width: dto.width,
        height: dto.height,
        palette: (dto.palette ?? []) as object[],
        grid: blankGrid as unknown as object,
        meta: { createdFrom: 'blank', ...dto.meta } as object,
      },
    });
    return toPatternDto(pattern);
  }

  async update(userId: string, id: string, dto: UpdatePatternDto): Promise<Pattern> {
    const existing = await this.getOwned(userId, id);
    const pattern = await this.prisma.pattern.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.width !== undefined && { width: dto.width }),
        ...(dto.height !== undefined && { height: dto.height }),
        ...(dto.palette !== undefined && { palette: dto.palette as unknown as object[] }),
        ...(dto.grid !== undefined && { grid: dto.grid as unknown as object }),
        ...(dto.meta !== undefined && {
          meta: { ...(existing.meta as object), ...dto.meta } as object,
        }),
      },
    });
    return toPatternDto(pattern);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.prisma.pattern.delete({ where: { id } });
  }

  private async getOwned(userId: string, id: string) {
    const pattern = await this.prisma.pattern.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!pattern) throw new NotFoundException('Pattern not found');
    if (pattern.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this pattern');
    }
    return pattern;
  }
}
