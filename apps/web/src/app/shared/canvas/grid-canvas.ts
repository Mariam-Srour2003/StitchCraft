import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { PaletteEntry } from '@stitchcraft/types';
import {
  CellPosition,
  DARK_GRID_THEME,
  GridTheme,
  LIGHT_GRID_THEME,
  RenderMode,
  cellSizeForZoom,
  pixelToCell,
} from './grid-render-math';
import { GridRenderParams, GridRenderingService } from './grid-rendering.service';

const BASE_CELL_SIZE = 20;

export type GridCanvasTool =
  | 'paint'
  | 'erase'
  | 'fill'
  | 'pick'
  | 'line'
  | 'rect'
  | 'rect-fill'
  | 'ellipse'
  | 'ellipse-fill'
  | 'text'
  | 'stitch';

/** Tools that act once per click rather than on every cell a drag passes over. */
const SINGLE_CLICK_TOOLS: ReadonlySet<GridCanvasTool> = new Set(['fill', 'pick', 'text']);

const DARK_QUERY = '(prefers-color-scheme: dark)';

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
  /** Explicit theme; when null the canvas follows the OS light/dark preference like the rest of the UI. */
  readonly theme = input<GridTheme | null>(null);
  /** Stitching progress rows (1 = done). */
  readonly progress = input<readonly (Int16Array | number[])[] | null>(null);
  readonly highlightIndex = input<number | null>(null);
  readonly showCenter = input(false);
  /** False for read-only viewers: no pointer input, default cursor. */
  readonly interactive = input(true);

  /**
   * Emitted for every cell touched during an active pointer-down drag
   * (paint/erase), or once per click for single-click tools (fill/pick).
   */
  readonly cellEdit = output<CellPosition>();
  /** Emitted once when a paint/erase drag ends, so the caller can close an undo transaction. */
  readonly strokeEnd = output<void>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly renderer = inject(GridRenderingService);

  protected readonly cellSize = computed(() => cellSizeForZoom(BASE_CELL_SIZE, this.zoomPercent()));
  protected readonly canvasWidthPx = computed(() => this.width() * this.cellSize());
  protected readonly canvasHeightPx = computed(() => this.height() * this.cellSize());

  private readonly prefersDark = signal(false);
  protected readonly resolvedTheme = computed(
    () => this.theme() ?? (this.prefersDark() ? DARK_GRID_THEME : LIGHT_GRID_THEME),
  );

  private lastStructuralKey = '';
  private lastPaletteRef: readonly PaletteEntry[] | null = null;
  private lastGridRows: readonly (Int16Array | number[])[] = [];
  private lastProgressRows: readonly (Int16Array | number[])[] = [];
  private isPointerDown = false;
  private lastPaintedCell: CellPosition | null = null;

  constructor() {
    this.watchColorScheme();

    effect(() => {
      // Track every input this component's render depends on.
      const width = this.width();
      const height = this.height();
      const palette = this.palette();
      const mode = this.mode();
      const cellSize = this.cellSize();
      const theme = this.resolvedTheme();
      const grid = this.grid();
      const progress = this.progress() ?? [];
      const highlightIndex = this.highlightIndex();
      const showCenter = this.showCenter();

      const canvasEl = this.canvasRef().nativeElement;
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return; // canvas 2D context is unavailable (e.g. jsdom in unit tests)

      // Back the canvas with devicePixelRatio-scaled pixels so stitches stay
      // crisp on high-DPI screens; drawing still happens in CSS pixels.
      const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
      const bitmapWidth = Math.round(width * cellSize * dpr);
      const bitmapHeight = Math.round(height * cellSize * dpr);
      if (canvasEl.width !== bitmapWidth) canvasEl.width = bitmapWidth;
      if (canvasEl.height !== bitmapHeight) canvasEl.height = bitmapHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const structuralKey = [
        width,
        height,
        mode,
        cellSize,
        dpr,
        bitmapWidth,
        bitmapHeight,
        highlightIndex,
        showCenter,
      ].join(':');
      const params: GridRenderParams = {
        grid,
        width,
        height,
        palette,
        mode,
        cellSize,
        theme,
        progress,
        highlightIndex,
        showCenter,
      };

      const needsFull =
        structuralKey !== this.lastStructuralKey ||
        palette !== this.lastPaletteRef ||
        theme !== this.lastTheme ||
        // region outlines/labels depend on neighbouring cells, so any change redraws
        (mode === 'paint-by-number' &&
          (grid !== this.lastGridRows || progress !== this.lastProgressRows));

      if (needsFull) {
        this.renderer.renderAll(ctx, params);
      } else {
        for (let y = 0; y < height; y++) {
          const gridRowSame = grid[y] === this.lastGridRows[y];
          const progressRowSame = progress[y] === this.lastProgressRows[y];
          if (gridRowSame && progressRowSame) continue; // unchanged row references - skip entirely
          for (let x = 0; x < width; x++) {
            if (
              grid[y][x] !== this.lastGridRows[y]?.[x] ||
              progress[y]?.[x] !== this.lastProgressRows[y]?.[x]
            ) {
              this.renderer.renderCell(ctx, params, x, y);
            }
          }
        }
      }

      this.lastStructuralKey = structuralKey;
      this.lastPaletteRef = palette;
      this.lastTheme = theme;
      this.lastGridRows = grid;
      this.lastProgressRows = progress;
    });
  }

  private lastTheme: GridTheme | null = null;

  private watchColorScheme(): void {
    const media =
      typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(DARK_QUERY) : null;
    if (!media) return;
    this.prefersDark.set(media.matches);
    const listener = (event: MediaQueryListEvent) => this.prefersDark.set(event.matches);
    media.addEventListener?.('change', listener);
    inject(DestroyRef).onDestroy(() => media.removeEventListener?.('change', listener));
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.interactive()) return;
    this.isPointerDown = true;
    this.canvasRef().nativeElement.setPointerCapture(event.pointerId);
    this.paintAt(event);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.isPointerDown && !SINGLE_CLICK_TOOLS.has(this.tool())) this.paintAt(event);
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
    // Map to CSS pixels (not bitmap pixels, which are devicePixelRatio-scaled).
    const scaleX = this.canvasWidthPx() / rect.width;
    const scaleY = this.canvasHeightPx() / rect.height;
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;

    const cell = pixelToCell(px, py, this.cellSize(), this.width(), this.height());
    if (!cell) return;
    if (
      this.lastPaintedCell &&
      cell.x === this.lastPaintedCell.x &&
      cell.y === this.lastPaintedCell.y
    )
      return;

    this.lastPaintedCell = cell;
    this.cellEdit.emit(cell);
  }
}
