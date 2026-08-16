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
  /** "Stitches" for cross-stitch/color-by-number, "Drills" for diamond - see PLAN.md M3. */
  readonly countLabel = input('Stitches');

  protected labelFor(row: LegendRow): string {
    const { color } = row.entry;
    return isDmcColor(color) ? `DMC ${color.code} — ${color.name}` : (color.label ?? color.hex);
  }
}
