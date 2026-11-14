import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsStore } from '../../core/settings/settings.store';
import {
  COMMON_COUNTS,
  drillEstimate,
  fabricSize,
  stitchesForSize,
  threadEstimate,
  timeEstimate,
} from './calculators';

/** Number inputs bound with ngModel can hand back null/strings while typing. */
const num = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

@Component({
  selector: 'sc-tools',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolsComponent {
  private readonly settings = inject(SettingsStore);
  protected readonly counts = COMMON_COUNTS;

  // Fabric size
  protected readonly width = signal(84);
  protected readonly height = signal(70);
  protected readonly count = signal(this.settings.fabricCount());
  protected readonly margin = signal(3);
  protected readonly overTwo = signal(false);
  protected readonly size = computed(() =>
    fabricSize(
      num(this.width()),
      num(this.height()),
      num(this.count(), 14) || 14,
      num(this.margin()),
      this.overTwo(),
    ),
  );
  protected readonly comparison = computed(() =>
    COMMON_COUNTS.map((count) => ({
      count,
      ...fabricSize(num(this.width()), num(this.height()), count, num(this.margin())),
    })),
  );

  // Fit to a frame
  protected readonly frameWidthIn = signal(8);
  protected readonly frameHeightIn = signal(10);
  protected readonly fit = computed(() => ({
    width: stitchesForSize(num(this.frameWidthIn()), num(this.count(), 14)),
    height: stitchesForSize(num(this.frameHeightIn()), num(this.count(), 14)),
  }));

  // Thread
  protected readonly stitches = signal(2500);
  protected readonly strands = signal<'auto' | 1 | 2 | 3>('auto');
  protected readonly thread = computed(() =>
    threadEstimate(
      num(this.stitches()),
      num(this.count(), 14) || 14,
      this.strands() === 'auto' ? undefined : Number(this.strands()),
    ),
  );

  // Diamond painting
  protected readonly drillWidth = signal(120);
  protected readonly drillHeight = signal(160);
  protected readonly drillSize = signal(this.settings.drillSizeMm());
  protected readonly drills = computed(() =>
    drillEstimate(
      num(this.drillWidth()),
      num(this.drillHeight()),
      num(this.drillSize(), 2.5) || 2.5,
    ),
  );

  // Time
  protected readonly timeStitches = signal(5000);
  protected readonly perHour = signal(this.settings.stitchesPerHour());
  protected readonly hoursPerDay = signal(1);
  protected readonly time = computed(() =>
    timeEstimate(num(this.timeStitches()), num(this.perHour()), num(this.hoursPerDay())),
  );
}
