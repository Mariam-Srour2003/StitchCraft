import { inject,Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { Pattern, Project } from '@stitchcraft/types';

import { PatternsApiService } from './patterns-api.service';
import { ProjectsApiService } from './projects-api.service';

export interface LibraryPattern {
  project: Project;
  pattern: Pattern;
}

/**
 * Every pattern the user owns, across all projects, newest first. Built
 * from the existing list endpoints (one call per project, in parallel), so
 * the dashboard and shopping list need no new API.
 */
@Injectable({ providedIn: 'root' })
export class PatternLibraryService {
  private readonly projectsApi = inject(ProjectsApiService);
  private readonly patternsApi = inject(PatternsApiService);

  async loadAll(): Promise<{ projects: Project[]; patterns: LibraryPattern[] }> {
    const projects = await firstValueFrom(this.projectsApi.list());
    const lists = await Promise.all(
      projects
        .filter((project) => project.patternIds.length > 0)
        .map(async (project) => {
          const patterns = await firstValueFrom(this.patternsApi.listForProject(project.id));
          return patterns.map((pattern) => ({ project, pattern }));
        }),
    );
    const patterns = lists
      .flat()
      .sort((a, b) => b.pattern.updatedAt.localeCompare(a.pattern.updatedAt));
    return { projects, patterns };
  }
}
