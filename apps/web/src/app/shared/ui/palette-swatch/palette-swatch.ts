import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { contrastTextColor } from '@stitchcraft/color';
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

  protected readonly glyphColor = computed(() => contrastTextColor(this.entry().color.rgb));
}
