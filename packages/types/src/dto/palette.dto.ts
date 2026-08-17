import type { CustomColor } from '../models/color.model';

export interface CreatePaletteDto {
  name: string;
  entries: Array<{ color: CustomColor; symbol: string }>;
}

export interface DmcQueryDto {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
