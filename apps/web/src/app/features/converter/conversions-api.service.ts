import { Injectable, inject } from '@angular/core';
import { ConversionJob, PatternType } from '@stitchcraft/types';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api/api-client.service';

export interface CreateConversionParams {
  targetType: PatternType;
  width: number;
  height: number;
  colorCount: number;
}

@Injectable({ providedIn: 'root' })
export class ConversionsApiService {
  private readonly api = inject(ApiClient);

  create(projectId: string, file: File, params: CreateConversionParams): Observable<{ jobId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('targetType', params.targetType);
    formData.append('width', String(params.width));
    formData.append('height', String(params.height));
    formData.append('colorCount', String(params.colorCount));
    // HttpClient sets the multipart Content-Type (with boundary) automatically for a FormData body.
    return this.api.post<{ jobId: string }>('/conversions', formData);
  }

  get(id: string): Observable<ConversionJob> {
    return this.api.get<ConversionJob>(`/conversions/${id}`);
  }
}
