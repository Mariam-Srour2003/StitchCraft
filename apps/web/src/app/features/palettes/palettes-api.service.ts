import { Injectable, inject } from '@angular/core';
import { DmcColor, PaginatedResponse } from '@stitchcraft/types';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api/api-client.service';

@Injectable({ providedIn: 'root' })
export class PalettesApiService {
  private readonly api = inject(ApiClient);

  searchDmc(search: string, page: number, pageSize: number): Observable<PaginatedResponse<DmcColor>> {
    return this.api.get<PaginatedResponse<DmcColor>>('/palettes/dmc', { search, page, pageSize });
  }
}
