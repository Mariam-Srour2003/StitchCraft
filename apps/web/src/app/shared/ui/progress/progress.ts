import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'sc-progress',
  standalone: true,
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Progress {
  /** 0-100. Values outside that range are clamped for display. */
  readonly value = input.required<number>();
  readonly label = input('Progress');

  protected readonly clamped = computed(() => Math.min(100, Math.max(0, this.value())));
}
