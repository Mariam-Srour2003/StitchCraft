import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PatternType } from '@stitchcraft/types';
import { computeFinishedSize } from './size-math';

@Component({
  selector: 'sc-size-readout',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './size-readout.html',
  styleUrl: './size-readout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SizeReadout {
  readonly type = input.required<PatternType>();
  readonly width = input.required<number>();
  readonly height = input.required<number>();
  /** Aida fabric count (cross-stitch/color-by-number) or drill size in mm (diamond). */
  readonly unitSize = input.required<number>();

  protected readonly size = computed(() =>
    computeFinishedSize(this.type(), this.width(), this.height(), this.unitSize()),
  );

  protected readonly unitLabel = computed(() =>
    this.type() === 'diamond' ? `${this.unitSize()}mm drills` : `${this.unitSize()}-count Aida`,
  );
}
