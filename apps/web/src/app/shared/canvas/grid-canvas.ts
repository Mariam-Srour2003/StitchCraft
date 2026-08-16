import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { PaletteEntry } from '@stitchcraft/types';
import { CellPosition, GridTheme, RenderMode, cellSizeForZoom, pixelToCell } from './grid-render-math';
import { GridRenderingService } from './grid-rendering.service';

const BASE_CELL_SIZE = 20;

const DEFAULT_THEME: GridTheme = {
  emptyCellFill: '#f4f1ec',
  paintedCellFill: '#ffffff',
  gridLine: '#d8d2c8',
  gridLineBold: '#a39a8c',
  symbolText: '#2b2622',
};

export type GridCanvasTool = 'paint' | 'erase';

/**
 * Renders a pattern grid and turns pointer input into `cellEdit` events.
 * Owns no business rules: it never mutates `grid` itself, doesn't know what
 * "paint" vs "erase" resolves to, and doesn't decide undo/redo. That all
 * lives in the caller's store - this component just reflects whatever grid
 * it's given and reports which cells the user interacted with.
 *
 * For efficient repaint of large grids, pass each row as a stable reference
 * that only changes when that row's contents change; unchanged rows are
 * skipped entirely rather than re-diffed cell by cell.
 */
@Component({
  selector: 'sc-grid-canvas',
  standalone: true,
  templateUrl: './grid-canvas.html',
  styleUrl: './grid-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridCanvas {
  readonly width = input.required<number>();
  readonly height = input.required<number>();
  readonly grid = input.required<readonly (Int16Array | number[])[]>();
  readonly palette = input.required<readonly PaletteEntry[]>();
  readonly mode = input<RenderMode>('block');
  readonly zoomPercent = input<number>(100);
  readonly tool = input<GridCanvasTool>('paint');
  readonly theme = input<GridTheme>(DEFAULT_THEME);

  /** Emitted for every cell touched during an active pointer-down drag. */
  readonly cellEdit = output<CellPosition>();
  /** Emitted once when a paint/erase drag ends, so the caller can close an undo transaction. */
  readonly strokeEnd = output<void>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly renderer = inject(GridRenderingService);

  protected readonly cellSize = computed(() => cellSizeForZoom(BASE_CELL_SIZE, this.zoomPercent()));
  protected readonly canvasWidthPx = computed(() => this.width() * this.cellSize());
  protected readonly canvasHeightPx = computed(() => this.height() * this.cellSize());

  private lastStructuralKey = '';
  private lastPaletteRef: readonly PaletteEntry[] | null = null;
  private lastGridRows: readonly (Int16Array | number[])[] = [];
  private isPointerDown = false;
  private lastPaintedCell: CellPosition | null = null;

  constructor() {
    effect(() => {
      // Track every input this component's render depends on.
      const width = this.width();
      const height = this.height();
      const palette = this.palette();
      const mode = this.mode();
      const cellSize = this.cellSize();
      const theme = this.theme();
      const grid = this.grid();

      const ctx = this.canvasRef().nativeElement.getContext('2d');
      if (!ctx) return; // canvas 2D context is unavailable (e.g. jsdom in unit tests)

      const structuralKey = `${width}x${height}:${mode}:${cellSize}`;
      const params = { grid, width, height, palette, mode, cellSize, theme };

      if (structuralKey !== this.lastStructuralKey || palette !== this.lastPaletteRef) {
        this.renderer.renderAll(ctx, params);
      } else {
        for (let y = 0; y < height; y++) {
          if (grid[y] === this.lastGridRows[y]) continue; // unchanged row reference - skip entirely
          for (let x = 0; x < width; x++) {
            if (grid[y][x] !== this.lastGridRows[y]?.[x]) {
              this.renderer.renderCell(ctx, params, x, y);
            }
          }
        }
      }

      this.lastStructuralKey = structuralKey;
      this.lastPaletteRef = palette;
      this.lastGridRows = grid;
    });
  }

  onPointerDown(event: PointerEvent): void {
    this.isPointerDown = true;
    this.canvasRef().nativeElement.setPointerCapture(event.pointerId);
    this.paintAt(event);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.isPointerDown) this.paintAt(event);
  }

  onPointerUp(): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    this.lastPaintedCell = null;
    this.strokeEnd.emit();
  }

  private paintAt(event: PointerEvent): void {
    const canvasEl = this.canvasRef().nativeElement;
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;

    const cell = pixelToCell(px, py, this.cellSize(), this.width(), this.height());
    if (!cell) return;
    if (this.lastPaintedCell && cell.x === this.lastPaintedCell.x && cell.y === this.lastPaintedCell.y) return;

    this.lastPaintedCell = cell;
    this.cellEdit.emit(cell);
  }
}
