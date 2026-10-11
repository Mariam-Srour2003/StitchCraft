import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  viewChild,
} from '@angular/core';
import type { EncodedRow, PaletteEntry } from '@stitchcraft/types';
import { decodeGrid } from '@stitchcraft/types';

/**
 * A small, non-interactive preview of a pattern: one solid pixel block per
 * cell, no grid lines, scaled to fit `size` CSS pixels on its longer side.
 * Used on cards (dashboard, template library) where the full editor canvas
 * would be too heavy.
 */
@Component({
  selector: 'sc-pattern-thumbnail',
  standalone: true,
  template: `<canvas
    #canvas
    class="sc-thumb"
    role="img"
    [attr.aria-label]="label()"
    [style.width.px]="cssWidth()"
    [style.height.px]="cssHeight()"
  ></canvas>`,
  styles: `
    .sc-thumb {
      display: block;
      image-rendering: pixelated;
      border-radius: var(--sc-radius-sm);
      background: #f4f1ec;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatternThumbnail {
  readonly width = input.required<number>();
  readonly height = input.required<number>();
  /** Either decoded rows or the API's RLE rows. */
  readonly grid = input.required<readonly (Int16Array | number[])[] | EncodedRow[]>();
  readonly palette = input.required<readonly PaletteEntry[]>();
  readonly size = input(120);
  readonly label = input('Pattern preview');

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private readonly scale = computed(() => this.size() / Math.max(1, this.width(), this.height()));
  protected readonly cssWidth = computed(() =>
    Math.max(1, Math.round(this.width() * this.scale())),
  );
  protected readonly cssHeight = computed(() =>
    Math.max(1, Math.round(this.height() * this.scale())),
  );

  constructor() {
    effect(() => {
      const width = this.width();
      const height = this.height();
      const rows = toDecoded(this.grid(), width);
      const palette = this.palette();
      const canvas = this.canvasRef().nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // One bitmap pixel per cell; CSS scales it up with pixelated rendering.
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      rows.forEach((row, y) => {
        for (let x = 0; x < width; x++) {
          const entry = palette[row[x]];
          if (!entry) continue;
          ctx.fillStyle = entry.color.hex;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    });
  }
}

function toDecoded(
  grid: readonly (Int16Array | number[])[] | EncodedRow[],
  width: number,
): readonly (Int16Array | number[])[] {
  const first = grid[0] as unknown;
  const isEncoded = Array.isArray(first) && first.length > 0 && Array.isArray(first[0]);
  return isEncoded ? decodeGrid(grid as EncodedRow[], width) : (grid as (Int16Array | number[])[]);
}
