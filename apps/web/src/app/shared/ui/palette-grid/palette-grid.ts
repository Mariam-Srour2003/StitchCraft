import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PaletteEntry } from '@stitchcraft/types';
import { PaletteSwatch } from '../palette-swatch/palette-swatch';

@Component({
  selector: 'sc-palette-grid',
  standalone: true,
  imports: [PaletteSwatch],
  templateUrl: './palette-grid.html',
  styleUrl: './palette-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaletteGrid {
  readonly entries = input.required<readonly PaletteEntry[]>();
  readonly selectedIndex = input<number | null>(null);
  readonly selectIndex = output<number>();
}
