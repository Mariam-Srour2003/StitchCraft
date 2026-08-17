import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { assignSymbols } from '@stitchcraft/color';
import { CustomColor, Palette, PaletteEntry } from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { Button } from '../../shared/ui/button/button';
import { ColorPicker } from '../../shared/ui/color-picker/color-picker';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Modal } from '../../shared/ui/modal/modal';
import { PaletteGrid } from '../../shared/ui/palette-grid/palette-grid';
import { PalettesApiService } from './palettes-api.service';

@Component({
  selector: 'sc-my-palettes',
  standalone: true,
  imports: [Button, ColorPicker, EmptyState, Modal, PaletteGrid],
  templateUrl: './my-palettes.component.html',
  styleUrl: './my-palettes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPalettesComponent {
  private readonly palettesApi = inject(PalettesApiService);

  protected readonly palettes = signal<Palette[]>([]);
  protected readonly loading = signal(true);

  protected readonly creating = signal(false);
  protected readonly newName = signal('My palette');
  protected readonly newEntries = signal<PaletteEntry[]>([]);

  constructor() {
    this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.palettes.set(await firstValueFrom(this.palettesApi.list()));
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.newName.set('My palette');
    this.newEntries.set([]);
    this.creating.set(true);
  }

  closeCreate(): void {
    this.creating.set(false);
  }

  setName(value: string): void {
    this.newName.set(value);
  }

  addColor(color: CustomColor): void {
    this.newEntries.update((entries) => {
      const symbol = assignSymbols(entries.length + 1)[entries.length];
      return [...entries, { index: entries.length, symbol, color }];
    });
  }

  /** Reuses palette-grid's swatch-click as a "remove this color" action in the build-a-palette form. */
  removeColorAt(index: number): void {
    this.newEntries.update((entries) =>
      entries.filter((e) => e.index !== index).map((e, i) => ({ ...e, index: i })),
    );
  }

  async savePalette(): Promise<void> {
    if (this.newEntries().length === 0) return;
    await firstValueFrom(
      this.palettesApi.create({
        name: this.newName(),
        entries: this.newEntries().map((e) => ({ color: e.color as CustomColor, symbol: e.symbol })),
      }),
    );
    this.closeCreate();
    await this.refresh();
  }

  async deletePalette(id: string): Promise<void> {
    await firstValueFrom(this.palettesApi.remove(id));
    await this.refresh();
  }
}
