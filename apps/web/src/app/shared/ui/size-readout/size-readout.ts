import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { boardsNeeded } from '@stitchcraft/color';
import { PatternType } from '@stitchcraft/types';

import { cellNoun } from '@app/domain/pattern/pattern-rules';

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
  /** Aida fabric count (cross-stitch/color-by-number), drill size in mm (diamond) or bead size in mm (fuse beads). */
  readonly unitSize = input.required<number>();
  /** Fuse beads: pegs along one side of the pegboard, to show how many boards the design needs. */
  readonly boardPegs = input<number | null>(null);

  protected readonly noun = computed(() => cellNoun(this.type()).toLowerCase());

  protected readonly boards = computed(() => {
    const pegs = this.boardPegs();
    return this.type() === 'fuse_bead' && pegs
      ? boardsNeeded(this.width(), this.height(), pegs)
      : null;
  });

  protected readonly size = computed(() =>
    computeFinishedSize(this.type(), this.width(), this.height(), this.unitSize()),
  );

  protected readonly unitLabel = computed(() => {
    if (this.type() === 'diamond') return `${this.unitSize()}mm drills`;
    if (this.type() === 'fuse_bead') return `${this.unitSize()}mm beads`;
    return `${this.unitSize()}-count Aida`;
  });
}
