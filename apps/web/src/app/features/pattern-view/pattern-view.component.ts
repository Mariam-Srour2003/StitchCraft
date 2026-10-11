import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { estimateMaterial } from '@stitchcraft/color';
import type { Pattern } from '@stitchcraft/types';
import { decodeGrid } from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { SettingsStore } from '../../core/settings/settings.store';
import { GridCanvas } from '../../shared/canvas/grid-canvas';
import type { RenderMode } from '../../shared/canvas/grid-render-math';
import {
  PATTERN_TYPE_LABELS,
  hoursRemaining,
  patternStats,
} from '../../shared/pattern/pattern-stats';
import { Button } from '../../shared/ui/button/button';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Legend, LegendRow } from '../../shared/ui/legend/legend';
import {
  SegmentedToggle,
  SegmentedToggleOption,
} from '../../shared/ui/segmented-toggle/segmented-toggle';
import { SizeReadout } from '../../shared/ui/size-readout/size-readout';
import { Slider } from '../../shared/ui/slider/slider';
import { PatternsApiService } from '../patterns/patterns-api.service';

const VIEW_MODES: SegmentedToggleOption<RenderMode>[] = [
  { value: 'symbol', label: 'Chart' },
  { value: 'x-stitch', label: 'Stitched' },
  { value: 'block', label: 'Block' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'paint-by-number', label: 'Paint #' },
];

/**
 * Read-only pattern page: a chart to look at, print or share on screen, with
 * the legend, shopping quantities and progress - without editor tools in
 * the way. Editing and stitching happen in the editor (linked from here).
 */
@Component({
  selector: 'sc-pattern-view',
  standalone: true,
  imports: [
    RouterLink,
    Button,
    EmptyState,
    GridCanvas,
    Legend,
    SegmentedToggle,
    SizeReadout,
    Slider,
  ],
  templateUrl: './pattern-view.component.html',
  styleUrl: './pattern-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatternViewComponent {
  /** Bound from the `:id` route param. */
  readonly id = input.required<string>();

  private readonly patternsApi = inject(PatternsApiService);
  private readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);

  protected readonly viewModes = VIEW_MODES;
  protected readonly typeLabels = PATTERN_TYPE_LABELS;

  protected readonly pattern = signal<Pattern | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  protected readonly mode = signal<RenderMode>('symbol');
  protected readonly zoom = signal(100);
  protected readonly showProgress = signal(true);

  protected readonly grid = computed(() => {
    const p = this.pattern();
    return p ? decodeGrid(p.grid, p.width) : [];
  });

  protected readonly progress = computed(() => {
    const p = this.pattern();
    if (!this.showProgress() || !p?.meta.progress || p.meta.progress.length !== p.height) {
      return null;
    }
    return decodeGrid(p.meta.progress, p.width);
  });

  protected readonly stats = computed(() => {
    const p = this.pattern();
    return p ? patternStats(p) : null;
  });

  protected readonly hoursLeft = computed(() => {
    const stats = this.stats();
    return stats ? hoursRemaining(stats, this.settings.stitchesPerHour()) : 0;
  });

  protected readonly unitSize = computed(() => {
    const p = this.pattern();
    if (!p) return 14;
    return p.type === 'diamond'
      ? (p.meta.drillSizeMm ?? this.settings.drillSizeMm())
      : (p.meta.fabricCount ?? this.settings.fabricCount());
  });

  protected readonly buyLabel = computed(() => {
    const type = this.pattern()?.type;
    return type === 'diamond' ? 'Drill bags' : type === 'cross_stitch' ? 'Skeins' : null;
  });

  protected readonly legendRows = computed<LegendRow[]>(() => {
    const p = this.pattern();
    const stats = this.stats();
    if (!p || !stats) return [];
    return p.palette
      .map((entry, i) => ({
        entry,
        count: stats.perColor[i] ?? 0,
        buy: estimateMaterial(p.type, stats.perColor[i] ?? 0, {
          fabricCount: p.meta.fabricCount,
          strands: this.settings.strands(),
        })?.quantity,
      }))
      .filter((row) => row.count > 0);
  });

  constructor() {
    effect(
      () => {
        const id = this.id();
        if (id) this.load(id);
      },
      { allowSignalWrites: true },
    );
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    try {
      const pattern = await firstValueFrom(this.patternsApi.get(id));
      this.pattern.set(pattern);
      this.mode.set(
        pattern.type === 'diamond'
          ? 'diamond'
          : pattern.type === 'color_by_number'
            ? 'paint-by-number'
            : 'symbol',
      );
    } catch {
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async duplicate(): Promise<void> {
    const p = this.pattern();
    if (!p) return;
    this.busy.set(true);
    try {
      const copy = await firstValueFrom(this.patternsApi.duplicate(p.id));
      await this.router.navigate(['/patterns', copy.id]);
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    const p = this.pattern();
    if (!p || !confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.patternsApi.remove(p.id));
      await this.router.navigate(['/projects']);
    } finally {
      this.busy.set(false);
    }
  }

  print(): void {
    globalThis.print?.();
  }
}
