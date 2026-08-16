import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Project } from '@stitchcraft/types';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { toProjectDto } from './projects.mapper';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      include: { patterns: true },
      orderBy: { updatedAt: 'desc' },
    });
    return projects.map(toProjectDto);
  }

  async findOne(userId: string, id: string): Promise<Project> {
    const project = await this.getOwned(userId, id);
    return toProjectDto(project);
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const project = await this.prisma.project.create({
      data: { userId, name: dto.name },
      include: { patterns: true },
    });
    return toProjectDto(project);
  }

  async update(userId: string, id: string, dto: UpdateProjectDto): Promise<Project> {
    await this.getOwned(userId, id);
    const project = await this.prisma.project.update({
      where: { id },
      data: dto,
      include: { patterns: true },
    });
    return toProjectDto(project);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.prisma.project.delete({ where: { id } });
  }

  /** Loads a project and throws unless it belongs to `userId`, so ownership checks can't be forgotten. */
  private async getOwned(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { patterns: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('You do not have access to this project');
    return project;
  }
}
