import { Injectable, inject } from '@angular/core';
import { ExportResponse } from '@stitchcraft/types';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api/api-client.service';

@Injectable({ providedIn: 'root' })
export class ExportApiService {
  private readonly api = inject(ApiClient);

  create(patternId: string): Observable<ExportResponse> {
    return this.api.post<ExportResponse>(`/exports/${patternId}`, {});
  }
}
