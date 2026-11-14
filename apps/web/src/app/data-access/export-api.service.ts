import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ExportResponse } from '@stitchcraft/types';

import { ApiClient } from '@app/core/api/api-client.service';

@Injectable({ providedIn: 'root' })
export class ExportApiService {
  private readonly api = inject(ApiClient);

  create(patternId: string): Observable<ExportResponse> {
    return this.api.post<ExportResponse>(`/exports/${patternId}`, {});
  }
}
