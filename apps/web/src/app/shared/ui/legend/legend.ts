import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { isDmcColor, PaletteEntry } from '@stitchcraft/types';

export interface LegendRow {
  entry: PaletteEntry;
  count: number;
}

@Component({
  selector: 'sc-legend',
  standalone: true,
  templateUrl: './legend.html',
  styleUrl: './legend.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Legend {
  readonly rows = input.required<readonly LegendRow[]>();

  protected labelFor(row: LegendRow): string {
    const { color } = row.entry;
    return isDmcColor(color) ? `DMC ${color.code} — ${color.name}` : (color.label ?? color.hex);
  }
}
