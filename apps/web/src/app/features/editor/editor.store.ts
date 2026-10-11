import { Injectable, computed, inject, signal } from '@angular/core';
import { assignSymbols } from '@stitchcraft/color';
import {
  CustomColor,
  DmcColor,
  EMPTY_CELL,
  Pattern,
  PaletteEntry,
  decodeGrid,
  isDmcColor,
  encodeGrid,
} from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { RenderMode } from '../../shared/canvas/grid-render-math';
import { CellChange, applyChanges, floodFill, resizeGrid } from './grid-ops';
import { LegendRow } from '../../shared/ui/legend/legend';
import { PatternsApiService } from '../patterns/patterns-api.service';

export type EditorTool = 'paint' | 'erase' | 'fill' | 'pick';

interface GridSnapshot {
  width: number;
  height: number;
  grid: Int16Array[];
}

/** One undoable step: a paint/erase drag or fill (cell edits), or a canvas resize. */
type HistoryStep =
  | { kind: 'cells'; changes: CellChange[] }
  | { kind: 'resize'; before: GridSnapshot; after: GridSnapshot };

/**
 * Owns all pattern-editing state and business rules: the store mutates the
 * grid; `grid-canvas` only ever reflects it and reports pointer input (see
 * PLAN.md's "component owns no business rules" split).
 */
@Injectable()
export class EditorStore {
  private readonly patternsApi = inject(PatternsApiService);

  private readonly patternIdSignal = signal<string | null>(null);
  private readonly nameSignal = signal('');
  private readonly typeSignal = signal<Pattern['type']>('cross_stitch');
  private readonly widthSignal = signal(0);
  private readonly heightSignal = signal(0);
  private readonly metaSignal = signal<Pattern['meta']>({ createdFrom: 'blank' });
  private readonly paletteSignal = signal<PaletteEntry[]>([]);
  private readonly gridSignal = signal<Int16Array[]>([]);

  private readonly toolSignal = signal<EditorTool>('paint');
  private readonly selectedPaletteIndexSignal = signal<number | null>(null);
  private readonly renderModeSignal = signal<RenderMode>('block');
  private readonly zoomPercentSignal = signal(100);

  private readonly loadingSignal = signal(false);
  private readonly savingSignal = signal(false);
  private readonly dirtySignal = signal(false);

  private readonly undoStackSignal = signal<HistoryStep[]>([]);
  private readonly redoStackSignal = signal<HistoryStep[]>([]);
  private currentStroke: CellChange[] | null = null;

  readonly patternId = this.patternIdSignal.asReadonly();
  readonly name = this.nameSignal.asReadonly();
  readonly type = this.typeSignal.asReadonly();
  readonly width = this.widthSignal.asReadonly();
  readonly height = this.heightSignal.asReadonly();
  readonly meta = this.metaSignal.asReadonly();
  readonly palette = this.paletteSignal.asReadonly();
  readonly grid = this.gridSignal.asReadonly();

  readonly tool = this.toolSignal.asReadonly();
  readonly selectedPaletteIndex = this.selectedPaletteIndexSignal.asReadonly();
  readonly renderMode = this.renderModeSignal.asReadonly();
  readonly zoomPercent = this.zoomPercentSignal.asReadonly();

  readonly loading = this.loadingSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly dirty = this.dirtySignal.asReadonly();

  readonly canUndo = computed(() => this.undoStackSignal().length > 0);
  readonly canRedo = computed(() => this.redoStackSignal().length > 0);

  readonly legendRows = computed<LegendRow[]>(() => {
    const counts = new Array(this.paletteSignal().length).fill(0);
    for (const row of this.gridSignal()) {
      for (const value of row) {
        if (value >= 0 && value < counts.length) counts[value]++;
      }
    }
    return this.paletteSignal().map((entry, i) => ({ entry, count: counts[i] }));
  });

  async load(patternId: string): Promise<void> {
    this.loadingSignal.set(true);
    try {
      const pattern = await firstValueFrom(this.patternsApi.get(patternId));
      this.applyPattern(pattern);
      // Default the view to the mode that best represents this pattern type
      // on first open; save() re-applies the (possibly updated) pattern too,
      // but must never do this or it would reset the user's chosen view on
      // every save.
      this.renderModeSignal.set(pattern.type === 'diamond' ? 'diamond' : 'block');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private applyPattern(pattern: Pattern): void {
    this.patternIdSignal.set(pattern.id);
    this.nameSignal.set(pattern.name);
    this.typeSignal.set(pattern.type);
    this.widthSignal.set(pattern.width);
    this.heightSignal.set(pattern.height);
    this.metaSignal.set(pattern.meta);
    this.paletteSignal.set(pattern.palette);
    this.gridSignal.set(decodeGrid(pattern.grid, pattern.width));
    this.undoStackSignal.set([]);
    this.redoStackSignal.set([]);
    this.currentStroke = null;
    this.dirtySignal.set(false);
  }

  setTool(tool: EditorTool): void {
    this.toolSignal.set(tool);
  }

  setSelectedPaletteIndex(index: number | null): void {
    this.selectedPaletteIndexSignal.set(index);
  }

  setRenderMode(mode: RenderMode): void {
    this.renderModeSignal.set(mode);
  }

  setZoomPercent(zoom: number): void {
    this.zoomPercentSignal.set(Math.min(400, Math.max(10, zoom)));
  }

  /**
   * Entry point for every cell the canvas reports, dispatched on the active
   * tool. Paint/erase are called per cell during a drag; fill and pick only
   * on pointer-down (the canvas doesn't emit drag moves for them).
   */
  applyTool(x: number, y: number): void {
    switch (this.toolSignal()) {
      case 'fill':
        this.fillAt(x, y);
        return;
      case 'pick':
        this.pickAt(x, y);
        return;
      default:
        this.paintCell(x, y);
    }
  }

  /** Called for every cell the pointer touches during an active paint/erase drag. */
  paintCell(x: number, y: number): void {
    const target = this.toolSignal() === 'erase' ? EMPTY_CELL : this.selectedPaletteIndexSignal();
    if (target === null) return; // paint tool with no color selected yet: no-op

    const before = this.gridSignal()[y][x];
    if (before === target) return;

    this.currentStroke ??= [];
    const existing = this.currentStroke.find((e) => e.x === x && e.y === y);
    if (existing) {
      // touched twice in one drag: keep the original `before`, update `after`
      existing.after = target;
    } else {
      this.currentStroke.push({ x, y, before, after: target });
    }

    this.setCell(x, y, target);
    this.dirtySignal.set(true);
  }

  /** Flood-fills the connected same-color region at (x, y) with the selected color, as one undo step. */
  fillAt(x: number, y: number): void {
    const target = this.selectedPaletteIndexSignal();
    if (target === null) return;
    const changes = floodFill(this.gridSignal(), x, y, target);
    if (changes.length === 0) return;
    this.gridSignal.set(applyChanges(this.gridSignal(), changes, 'after'));
    this.pushHistory({ kind: 'cells', changes });
  }

  /** Eyedropper: selects the palette color under (x, y) and switches back to paint. Empty cells are ignored. */
  pickAt(x: number, y: number): void {
    const value = this.gridSignal()[y]?.[x];
    if (value === undefined || value === EMPTY_CELL) return;
    this.selectedPaletteIndexSignal.set(value);
    this.toolSignal.set('paint');
  }

  /** Closes the current paint/erase drag into one undoable step. */
  endStroke(): void {
    if (this.currentStroke && this.currentStroke.length > 0) {
      this.undoStackSignal.update((stack) => [
        ...stack,
        { kind: 'cells', changes: this.currentStroke as CellChange[] },
      ]);
      this.redoStackSignal.set([]);
    }
    this.currentStroke = null;
  }

  undo(): void {
    const stack = this.undoStackSignal();
    if (stack.length === 0) return;
    const step = stack[stack.length - 1];
    this.applyStep(step, 'before');
    this.undoStackSignal.set(stack.slice(0, -1));
    this.redoStackSignal.update((redo) => [...redo, step]);
    this.dirtySignal.set(true);
  }

  redo(): void {
    const stack = this.redoStackSignal();
    if (stack.length === 0) return;
    const step = stack[stack.length - 1];
    this.applyStep(step, 'after');
    this.redoStackSignal.set(stack.slice(0, -1));
    this.undoStackSignal.update((undo) => [...undo, step]);
    this.dirtySignal.set(true);
  }

  /** Rebuilds the grid at new dimensions, preserving overlapping (top-left anchored) cells. Undoable. */
  resize(newWidth: number, newHeight: number): void {
    const before = this.snapshot();
    if (before.width === newWidth && before.height === newHeight) return;
    const after: GridSnapshot = {
      width: newWidth,
      height: newHeight,
      grid: resizeGrid(before.grid, before.width, newWidth, newHeight, EMPTY_CELL),
    };
    this.currentStroke = null;
    this.restore(after);
    this.pushHistory({ kind: 'resize', before, after });
  }

  /**
   * Adds a color and selects it. A DMC thread already in the palette is just
   * selected rather than added twice (two entries for one floss would split
   * its stitch count across two legend rows).
   */
  addColorToPalette(color: DmcColor | CustomColor): PaletteEntry {
    const palette = this.paletteSignal();
    if (isDmcColor(color)) {
      const existing = palette.find((e) => isDmcColor(e.color) && e.color.code === color.code);
      if (existing) {
        this.selectedPaletteIndexSignal.set(existing.index);
        return existing;
      }
    }
    const symbol = assignSymbols(palette.length + 1)[palette.length];
    const entry: PaletteEntry = { index: palette.length, symbol, color };
    this.paletteSignal.set([...palette, entry]);
    this.selectedPaletteIndexSignal.set(entry.index);
    this.dirtySignal.set(true);
    return entry;
  }

  async save(): Promise<void> {
    const id = this.patternIdSignal();
    if (!id) return;

    this.savingSignal.set(true);
    try {
      const grid = encodeGrid(
        this.gridSignal().map((row) => Array.from(row, (v) => (v === EMPTY_CELL ? null : v))),
      );
      const updated = await firstValueFrom(
        this.patternsApi.update(id, {
          width: this.widthSignal(),
          height: this.heightSignal(),
          palette: this.paletteSignal(),
          grid,
        }),
      );
      this.applyPattern(updated);
    } finally {
      this.savingSignal.set(false);
    }
  }

  private pushHistory(step: HistoryStep): void {
    this.undoStackSignal.update((stack) => [...stack, step]);
    this.redoStackSignal.set([]);
    this.dirtySignal.set(true);
  }

  private applyStep(step: HistoryStep, side: 'before' | 'after'): void {
    if (step.kind === 'cells') {
      this.gridSignal.set(applyChanges(this.gridSignal(), step.changes, side));
    } else {
      this.restore(step[side]);
    }
  }

  private snapshot(): GridSnapshot {
    return { width: this.widthSignal(), height: this.heightSignal(), grid: this.gridSignal() };
  }

  private restore(snapshot: GridSnapshot): void {
    this.widthSignal.set(snapshot.width);
    this.heightSignal.set(snapshot.height);
    this.gridSignal.set(snapshot.grid);
  }

  private setCell(x: number, y: number, value: number): void {
    this.gridSignal.update((rows) => {
      const next = rows.slice();
      const newRow = next[y].slice();
      newRow[x] = value;
      next[y] = newRow;
      return next;
    });
  }
}
