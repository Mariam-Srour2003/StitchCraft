import { Injectable, inject } from '@angular/core';
import { CreatePatternDto, Pattern, UpdatePatternDto } from '@stitchcraft/types';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api/api-client.service';

@Injectable({ providedIn: 'root' })
export class PatternsApiService {
  private readonly api = inject(ApiClient);

  listForProject(projectId: string): Observable<Pattern[]> {
    return this.api.get<Pattern[]>('/patterns', { projectId });
  }

  get(id: string): Observable<Pattern> {
    return this.api.get<Pattern>(`/patterns/${id}`);
  }

  create(dto: CreatePatternDto): Observable<Pattern> {
    return this.api.post<Pattern>('/patterns', dto);
  }

  update(id: string, dto: UpdatePatternDto): Observable<Pattern> {
    return this.api.patch<Pattern>(`/patterns/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/patterns/${id}`);
  }
}
