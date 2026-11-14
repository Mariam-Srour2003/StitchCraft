import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { isDmcColor, PaletteEntry } from '@stitchcraft/types';

export interface LegendRow {
  entry: PaletteEntry;
  count: number;
  /** Skeins/drill bags to buy; shown only when the legend has a `buyLabel`. */
  buy?: number;
  /** Cells of this color marked as stitched; shown only when `showProgress` is on. */
  done?: number;
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
  /** Header for the shopping-quantity column ("Skeins", "Drill bags"); null hides it. */
  readonly buyLabel = input<string | null>(null);
  readonly showProgress = input(false);
  /** Palette index currently highlighted on the canvas, if any. */
  readonly highlightedIndex = input<number | null>(null);
  /** Emitted when a row is clicked, so the host can highlight that color. */
  readonly rowSelected = output<number>();

  protected percentDone(row: LegendRow): number {
    return row.count === 0 ? 0 : Math.floor(((row.done ?? 0) / row.count) * 100);
  }

  protected columnCount(): number {
    return 3 + (this.buyLabel() ? 1 : 0) + (this.showProgress() ? 1 : 0);
  }

  protected labelFor(row: LegendRow): string {
    const { color } = row.entry;
    return isDmcColor(color) ? `DMC ${color.code} — ${color.name}` : (color.label ?? color.hex);
  }
}
