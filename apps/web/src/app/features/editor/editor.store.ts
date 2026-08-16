import { Injectable, computed, inject, signal } from '@angular/core';
import { assignSymbols } from '@stitchcraft/color';
import {
  CustomColor,
  DmcColor,
  EMPTY_CELL,
  Pattern,
  PaletteEntry,
  decodeGrid,
  encodeGrid,
} from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { RenderMode } from '../../shared/canvas/grid-render-math';
import { LegendRow } from '../../shared/ui/legend/legend';
import { PatternsApiService } from '../patterns/patterns-api.service';

export type EditorTool = 'paint' | 'erase';

interface UndoEntry {
  x: number;
  y: number;
  before: number;
  after: number;
}

type UndoStroke = UndoEntry[];

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

  private readonly undoStackSignal = signal<UndoStroke[]>([]);
  private readonly redoStackSignal = signal<UndoStroke[]>([]);
  private currentStroke: UndoStroke | null = null;

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

  /** Called for every cell the pointer touches during an active paint/erase drag. */
  paintCell(x: number, y: number): void {
    const target =
      this.toolSignal() === 'erase' ? EMPTY_CELL : this.selectedPaletteIndexSignal();
    if (target === null) return; // paint tool with no color selected yet: no-op

    const before = this.gridSignal()[y][x];
    if (before === target) return;

    this.currentStroke ??= [];
    if (!this.currentStroke.some((e) => e.x === x && e.y === y)) {
      this.currentStroke.push({ x, y, before, after: target });
    } else {
      // touched twice in one drag: keep the original `before`, update `after`
      const entry = this.currentStroke.find((e) => e.x === x && e.y === y)!;
      entry.after = target;
    }

    this.setCell(x, y, target);
    this.dirtySignal.set(true);
  }

  /** Closes the current paint/erase drag into one undoable step. */
  endStroke(): void {
    if (this.currentStroke && this.currentStroke.length > 0) {
      this.undoStackSignal.update((stack) => [...stack, this.currentStroke as UndoStroke]);
      this.redoStackSignal.set([]);
    }
    this.currentStroke = null;
  }

  undo(): void {
    const stack = this.undoStackSignal();
    if (stack.length === 0) return;
    const stroke = stack[stack.length - 1];
    for (const entry of stroke) this.setCell(entry.x, entry.y, entry.before);
    this.undoStackSignal.set(stack.slice(0, -1));
    this.redoStackSignal.update((redo) => [...redo, stroke]);
    this.dirtySignal.set(true);
  }

  redo(): void {
    const stack = this.redoStackSignal();
    if (stack.length === 0) return;
    const stroke = stack[stack.length - 1];
    for (const entry of stroke) this.setCell(entry.x, entry.y, entry.after);
    this.redoStackSignal.set(stack.slice(0, -1));
    this.undoStackSignal.update((undo) => [...undo, stroke]);
    this.dirtySignal.set(true);
  }

  /** Rebuilds the grid at new dimensions, preserving overlapping (top-left anchored) cells. Not undoable. */
  resize(newWidth: number, newHeight: number): void {
    const oldGrid = this.gridSignal();
    const oldWidth = this.widthSignal();

    const nextGrid: Int16Array[] = Array.from({ length: newHeight }, (_, y) => {
      const row = new Int16Array(newWidth).fill(EMPTY_CELL);
      const oldRow = oldGrid[y];
      if (oldRow) {
        const copyWidth = Math.min(newWidth, oldWidth);
        row.set(oldRow.subarray(0, copyWidth));
      }
      return row;
    });

    this.widthSignal.set(newWidth);
    this.heightSignal.set(newHeight);
    this.gridSignal.set(nextGrid);
    this.undoStackSignal.set([]);
    this.redoStackSignal.set([]);
    this.currentStroke = null;
    this.dirtySignal.set(true);
  }

  addColorToPalette(color: DmcColor | CustomColor): PaletteEntry {
    const palette = this.paletteSignal();
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
