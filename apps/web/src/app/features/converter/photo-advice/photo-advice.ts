import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { AdviceFix, AdviceSeverity, ImageAnalysis, VisionAdvice } from '@stitchcraft/types';

import { Button } from '@app/shared/ui/button/button';

export type AdviceState = 'idle' | 'loading' | 'ready' | 'error';

const SEVERITY_ICON: Record<AdviceSeverity, string> = {
  good: '✓',
  info: 'i',
  warning: '!',
  problem: '✕',
};

const SEVERITY_LABEL: Record<AdviceSeverity, string> = {
  good: 'Good',
  info: 'Tip',
  warning: 'Warning',
  problem: 'Problem',
};

const VERDICT_LABEL: Record<ImageAnalysis['verdict'], string> = {
  great: 'Great for stitching',
  good: 'Good for stitching',
  fair: 'Will work, with compromises',
  poor: 'Likely to stitch badly',
};

/** The image advisor's findings, with one-click fixes. */
@Component({
  selector: 'sc-photo-advice',
  standalone: true,
  imports: [Button],
  templateUrl: './photo-advice.html',
  styleUrl: './photo-advice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAdvice {
  readonly analysis = input<ImageAnalysis | null>(null);
  readonly state = input<AdviceState>('idle');
  readonly applyFix = output<AdviceFix>();
  readonly applyAll = output<void>();
  readonly retry = output<void>();

  /** Optional AI second opinion (shown only when the server offers it). */
  readonly visionEnabled = input(false);
  readonly visionAdvice = input<VisionAdvice | null>(null);
  readonly visionState = input<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly visionError = input('');
  readonly visionStale = input(false);
  readonly askVision = output<void>();

  protected readonly icon = SEVERITY_ICON;
  protected readonly severityLabel = SEVERITY_LABEL;
  protected readonly verdictLabel = VERDICT_LABEL;

  /** Fixes worth one "apply all" button: only when there are two or more. */
  protected readonly fixCount = computed(
    () => this.analysis()?.advice.filter((a) => a.fix).length ?? 0,
  );
}
