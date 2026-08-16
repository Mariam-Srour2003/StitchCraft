import { Injectable, inject } from '@angular/core';
import { CreateProjectDto, Project } from '@stitchcraft/types';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api/api-client.service';

@Injectable({ providedIn: 'root' })
export class ProjectsApiService {
  private readonly api = inject(ApiClient);

  list(): Observable<Project[]> {
    return this.api.get<Project[]>('/projects');
  }

  create(dto: CreateProjectDto): Observable<Project> {
    return this.api.post<Project>('/projects', dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/projects/${id}`);
  }
}
