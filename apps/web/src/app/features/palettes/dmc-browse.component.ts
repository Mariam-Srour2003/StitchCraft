import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DmcColor } from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { PalettesApiService } from './palettes-api.service';

const PAGE_SIZE = 60;

@Component({
  selector: 'sc-dmc-browse',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dmc-browse.component.html',
  styleUrl: './dmc-browse.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmcBrowseComponent {
  private readonly palettesApi = inject(PalettesApiService);

  protected readonly search = signal('');
  protected readonly colors = signal<DmcColor[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);

  constructor() {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.palettesApi.searchDmc(this.search(), 1, PAGE_SIZE));
      this.colors.set(result.items);
      this.total.set(result.total);
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    this.load();
  }
}
