import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { BeadCatalogue, DmcColor } from '@hobbygrid/types';

const RESULT_LIMIT = 24;

/**
 * Bead colour search for a fuse-bead pattern's sidebar: type a code ("H18")
 * or a name ("black") to find a colour in the pattern's bead line, click to
 * add it to the palette. The bead lines are small and ship with the app, so
 * this filters in the browser instead of asking the server like the DMC
 * search does. With nothing typed it lists the line's colours in order, so
 * someone browsing can just pick.
 */
@Component({
  selector: 'sc-bead-color-search',
  standalone: true,
  templateUrl: './bead-color-search.component.html',
  // Same look as the DMC thread search; the class names match.
  styleUrl: '../dmc-thread-search/dmc-thread-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeadColorSearchComponent {
  readonly catalogue = input.required<BeadCatalogue>();
  /** Codes already in the pattern palette, shown as such in the results. */
  readonly paletteCodes = input<readonly string[]>([]);
  readonly colorSelected = output<DmcColor>();

  protected readonly term = signal('');
  protected readonly paletteCodeSet = computed(() => new Set(this.paletteCodes()));

  protected readonly matches = computed(() => {
    const term = this.term().trim().toLowerCase();
    const colors = this.catalogue().colors;
    if (!term) return colors;
    return colors.filter(
      (c) => c.code.toLowerCase().includes(term) || c.name.toLowerCase().includes(term),
    );
  });
  protected readonly results = computed(() => this.matches().slice(0, RESULT_LIMIT));

  onTermInput(value: string): void {
    this.term.set(value);
  }

  select(color: DmcColor): void {
    this.colorSelected.emit(color);
  }

  /** Special finishes are worth flagging: they look different once ironed. */
  protected finishNote(color: DmcColor): string | null {
    return color.finish && color.finish !== 'solid' ? color.finish : null;
  }
}
