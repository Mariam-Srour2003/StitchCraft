import { Injectable, inject } from '@angular/core';
import { CreatePaletteDto, DmcColor, PaginatedResponse, Palette } from '@stitchcraft/types';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api/api-client.service';

@Injectable({ providedIn: 'root' })
export class PalettesApiService {
  private readonly api = inject(ApiClient);

  searchDmc(search: string, page: number, pageSize: number): Observable<PaginatedResponse<DmcColor>> {
    return this.api.get<PaginatedResponse<DmcColor>>('/palettes/dmc', { search, page, pageSize });
  }

  list(): Observable<Palette[]> {
    return this.api.get<Palette[]>('/palettes');
  }

  create(dto: CreatePaletteDto): Observable<Palette> {
    return this.api.post<Palette>('/palettes', dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/palettes/${id}`);
  }
}
