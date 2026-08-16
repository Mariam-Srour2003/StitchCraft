import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { isDmcColor, PaletteEntry } from '@stitchcraft/types';

@Component({
  selector: 'sc-palette-swatch',
  standalone: true,
  templateUrl: './palette-swatch.html',
  styleUrl: './palette-swatch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaletteSwatch {
  readonly entry = input.required<PaletteEntry>();
  readonly selected = input(false);
  readonly pressed = output<void>();

  protected readonly tooltip = computed(() => {
    const { color } = this.entry();
    return isDmcColor(color) ? `DMC ${color.code} — ${color.name}` : (color.label ?? color.hex);
  });

  /** Chooses black or white glyph text for contrast against the swatch's fill color (WCAG-ish luminance heuristic). */
  protected readonly glyphColor = computed(() => {
    const { r, g, b } = this.entry().color.rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000000' : '#ffffff';
  });
}
