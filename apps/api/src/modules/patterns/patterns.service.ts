import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { encodeGrid, findBackstitchProblem, findGridProblem, Pattern } from '@stitchcraft/types';

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

  async findAllForProject(userId: string, projectId: string): Promise<Pattern[]> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId)
      throw new ForbiddenException('You do not have access to this project');

    const patterns = await this.prisma.pattern.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
    return patterns.map(toPatternDto);
  }

  async create(userId: string, dto: CreatePatternDto): Promise<Pattern> {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId)
      throw new ForbiddenException('You do not have access to this project');

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
    this.assertConsistentGrid(existing, dto);
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

  /**
   * Copies a pattern (grid, palette, sizing) into the same project as
   * "<name> (copy)". Stitching progress is deliberately not copied: a
   * duplicate is a fresh start, e.g. to try a colorway or stitch it again.
   */
  async duplicate(userId: string, id: string): Promise<Pattern> {
    const source = await this.getOwned(userId, id);
    const meta = { ...((source.meta ?? {}) as Record<string, unknown>) };
    delete meta['progress'];
    const pattern = await this.prisma.pattern.create({
      data: {
        projectId: source.projectId,
        name: `${source.name} (copy)`,
        type: source.type,
        width: source.width,
        height: source.height,
        palette: source.palette as object[],
        grid: source.grid as object,
        meta: meta as object,
      },
    });
    return toPatternDto(pattern);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.prisma.pattern.delete({ where: { id } });
  }

  /**
   * Rejects saves that would leave the stored grid disagreeing with the
   * pattern's dimensions or palette - e.g. a resize without a new grid, a
   * row of the wrong length, or a cell pointing at a deleted color. Without
   * this, one bad client save corrupts a pattern for every later reader
   * (editor, exports, shopping lists).
   */
  private assertConsistentGrid(
    existing: { width: number; height: number; grid: unknown; palette: unknown; meta: unknown },
    dto: UpdatePatternDto,
  ): void {
    const width = dto.width ?? existing.width;
    const height = dto.height ?? existing.height;

    const touchesGrid =
      dto.grid !== undefined ||
      dto.width !== undefined ||
      dto.height !== undefined ||
      dto.palette !== undefined;
    if (touchesGrid) {
      const grid = dto.grid ?? existing.grid;
      const paletteLength = (dto.palette ?? (existing.palette as unknown[]) ?? []).length;
      const problem = findGridProblem(grid, width, height, paletteLength);
      if (problem) throw new BadRequestException(`Invalid pattern grid: ${problem}`);
    }

    // Backstitches are checked when they change, and also when the grid's size or
    // palette changes underneath them (a shrink or a deleted color can strand lines).
    const newMeta = dto.meta as { progress?: unknown; backstitches?: unknown } | undefined;
    const backstitches =
      newMeta?.backstitches ?? (existing.meta as { backstitches?: unknown } | null)?.backstitches;
    if (backstitches !== undefined && (newMeta?.backstitches !== undefined || touchesGrid)) {
      const paletteLength = (dto.palette ?? (existing.palette as unknown[]) ?? []).length;
      const problem = findBackstitchProblem(backstitches, width, height, paletteLength);
      if (problem) throw new BadRequestException(`Invalid backstitches: ${problem}`);
    }

    const progress = newMeta?.progress;
    if (progress !== undefined) {
      // Progress cells are 1 (done) or empty, so validate against a 2-entry "palette".
      const problem = findGridProblem(progress, width, height, 2);
      if (problem) throw new BadRequestException(`Invalid stitching progress: ${problem}`);
    }
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
