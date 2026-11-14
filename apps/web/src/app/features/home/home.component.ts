import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { SettingsStore } from '../../core/settings/settings.store';
import {
  PATTERN_TYPE_LABELS,
  PatternStats,
  hoursRemaining,
  patternStats,
} from '../../shared/pattern/pattern-stats';
import { PatternThumbnail } from '../../shared/pattern/pattern-thumbnail';
import { Progress } from '../../shared/ui/progress/progress';
import { LibraryPattern, PatternLibraryService } from '../patterns/pattern-library.service';

interface DashboardPattern extends LibraryPattern {
  stats: PatternStats;
}

const CRAFTS = [
  {
    title: 'Cross-stitch',
    body: 'Chart your own designs with DMC threads, symbols and a printable PDF chart.',
  },
  {
    title: 'Diamond painting',
    body: 'Plan drill colors, see the sparkle preview and know how many bags to buy.',
  },
  {
    title: 'Paint by number',
    body: 'Turn a photo into outlined, numbered regions - one number per area.',
  },
];

@Component({
  selector: 'sc-home',
  standalone: true,
  imports: [RouterLink, PatternThumbnail, Progress],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly auth = inject(AuthStore);
  private readonly library = inject(PatternLibraryService);
  private readonly settings = inject(SettingsStore);

  protected readonly crafts = CRAFTS;
  protected readonly typeLabels = PATTERN_TYPE_LABELS;

  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly projectCount = signal(0);
  protected readonly patterns = signal<DashboardPattern[]>([]);

  protected readonly inProgress = computed(() =>
    this.patterns()
      .filter((p) => p.stats.done > 0 && p.stats.percent < 100)
      .slice(0, 4),
  );
  protected readonly recent = computed(() => this.patterns().slice(0, 6));
  protected readonly totals = computed(() => {
    const speed = this.settings.stitchesPerHour();
    let stitches = 0;
    let done = 0;
    let hours = 0;
    let finished = 0;
    for (const { stats } of this.patterns()) {
      stitches += stats.total;
      done += stats.done;
      hours += hoursRemaining(stats, speed);
      if (stats.total > 0 && stats.done === stats.total) finished++;
    }
    return { stitches, done, hours, finished };
  });

  constructor() {
    effect(
      () => {
        if (this.auth.isAuthenticated()) this.load();
      },
      { allowSignalWrites: true },
    );
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const { projects, patterns } = await this.library.loadAll();
      this.projectCount.set(projects.length);
      this.patterns.set(patterns.map((p) => ({ ...p, stats: patternStats(p.pattern) })));
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected hoursLeft(stats: PatternStats): number {
    return hoursRemaining(stats, this.settings.stitchesPerHour());
  }
}
