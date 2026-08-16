import { Project as PrismaProject, Pattern as PrismaPattern } from '@prisma/client';
import { Project } from '@stitchcraft/types';

type ProjectWithPatterns = PrismaProject & { patterns: PrismaPattern[] };

export function toProjectDto(project: ProjectWithPatterns): Project {
  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    patternIds: project.patterns.map((p) => p.id),
    sourceImageRef: project.sourceImageRef ?? undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
