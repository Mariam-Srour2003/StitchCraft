import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DmcColor } from '@stitchcraft/types';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { PalettesApiService } from '../palettes/palettes-api.service';

export const DMC_SEARCH_DEBOUNCE_MS = 250;
const RESULT_LIMIT = 24;

/**
 * Compact DMC thread search for the editor sidebar: type a code ("310") or a
 * name ("salmon"), click a result to add it to the pattern palette. Only
 * queries once something is typed, so the sidebar isn't filled with all
 * ~450 threads by default. `switchMap` drops stale responses, so a slow
 * earlier query can never overwrite results for what's typed now.
 */
@Component({
  selector: 'sc-dmc-thread-search',
  standalone: true,
  templateUrl: './dmc-thread-search.component.html',
  styleUrl: './dmc-thread-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmcThreadSearchComponent {
  private readonly palettesApi = inject(PalettesApiService);

  /** DMC codes already in the pattern palette, shown as such in the results. */
  readonly paletteCodes = input<readonly string[]>([]);
  readonly threadSelected = output<DmcColor>();

  protected readonly term = signal('');
  protected readonly results = signal<DmcColor[]>([]);
  protected readonly total = signal(0);
  protected readonly searching = signal(false);
  protected readonly failed = signal(false);

  protected readonly paletteCodeSet = computed(() => new Set(this.paletteCodes()));

  private readonly terms$ = new Subject<string>();

  constructor() {
    this.terms$
      .pipe(
        map((t) => t.trim()),
        debounceTime(DMC_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((t) => {
          this.failed.set(false);
          this.searching.set(t.length > 0);
        }),
        switchMap((t) =>
          t.length === 0
            ? of({ items: [] as DmcColor[], total: 0 })
            : this.palettesApi.searchDmc(t, 1, RESULT_LIMIT).pipe(
                catchError(() => {
                  this.failed.set(true);
                  return of({ items: [] as DmcColor[], total: 0 });
                }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.results.set(page.items);
        this.total.set(page.total);
        this.searching.set(false);
      });
  }

  onTermInput(value: string): void {
    this.term.set(value);
    this.terms$.next(value);
  }

  select(color: DmcColor): void {
    this.threadSelected.emit(color);
  }
}
