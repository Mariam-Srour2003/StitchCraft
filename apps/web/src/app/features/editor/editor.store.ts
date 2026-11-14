import { Injectable, computed, inject, signal } from '@angular/core';
import { assignSymbols, estimateMaterial } from '@stitchcraft/color';
import {
  CustomColor,
  DmcColor,
  EMPTY_CELL,
  Pattern,
  PaletteEntry,
  decodeGrid,
  encodeGrid,
  isDmcColor,
} from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { CellPosition, RenderMode } from '../../shared/canvas/grid-render-math';
import { LegendRow } from '../../shared/ui/legend/legend';
import { SettingsStore } from '../../core/settings/settings.store';
import { PatternsApiService } from '../patterns/patterns-api.service';
import {
  CellChange,
  applyChanges,
  compactPalette,
  flipHorizontal,
  flipVertical,
  floodFill,
  replaceValue,
  resizeGrid,
  rotateClockwise,
} from './grid-ops';
import { textPoints } from './pixel-font';
import {
  Symmetry,
  clipToGrid,
  ellipsePoints,
  linePoints,
  mirrorPoints,
  rectPoints,
} from './shapes';

export type EditorTool =
  | 'paint'
  | 'erase'
  | 'fill'
  | 'pick'
  | 'line'
  | 'rect'
  | 'rect-fill'
  | 'ellipse'
  | 'ellipse-fill'
  | 'text';

const SHAPE_TOOLS: ReadonlySet<EditorTool> = new Set([
  'line',
  'rect',
  'rect-fill',
  'ellipse',
  'ellipse-fill',
]);

export function isShapeTool(tool: EditorTool): boolean {
  return SHAPE_TOOLS.has(tool);
}

const NOT_DONE = 0;
const DONE = 1;

/** Everything a whole-pattern operation (resize, flip, rotate, palette clean-up) can change. */
interface PatternSnapshot {
  width: number;
  height: number;
  grid: Int16Array[];
  palette: PaletteEntry[];
  progress: Int16Array[];
}

/**
 * One undoable step: a set of cell edits (a paint/erase drag, a fill, a
 * shape, stamped text, a recolor), or a before/after snapshot for operations
 * that change dimensions or the palette. Snapshots hold row references,
 * which is cheap because rows are never mutated in place.
 */
type HistoryStep =
  | { kind: 'cells'; changes: CellChange[] }
  | { kind: 'snapshot'; before: PatternSnapshot; after: PatternSnapshot };

function blankProgress(width: number, height: number): Int16Array[] {
  return Array.from({ length: height }, () => new Int16Array(width));
}

/**
 * Owns all pattern-editing state and business rules: the store mutates the
 * grid; `grid-canvas` only ever reflects it and reports pointer input (see
 * PLAN.md's "component owns no business rules" split).
 */
@Injectable()
export class EditorStore {
  private readonly patternsApi = inject(PatternsApiService);
  private readonly settings = inject(SettingsStore);

  private readonly patternIdSignal = signal<string | null>(null);
  private readonly nameSignal = signal('');
  private readonly typeSignal = signal<Pattern['type']>('cross_stitch');
  private readonly widthSignal = signal(0);
  private readonly heightSignal = signal(0);
  private readonly metaSignal = signal<Pattern['meta']>({ createdFrom: 'blank' });
  private readonly paletteSignal = signal<PaletteEntry[]>([]);
  private readonly gridSignal = signal<Int16Array[]>([]);
  private readonly progressSignal = signal<Int16Array[]>([]);

  private readonly toolSignal = signal<EditorTool>('paint');
  private readonly selectedPaletteIndexSignal = signal<number | null>(null);
  private readonly renderModeSignal = signal<RenderMode>('block');
  private readonly zoomPercentSignal = signal(100);
  private readonly symmetrySignal = signal<Symmetry>('none');
  private readonly stampTextSignal = signal('');
  private readonly stitchModeSignal = signal(false);
  private readonly highlightIndexSignal = signal<number | null>(null);
  private readonly showCenterSignal = signal(true);

  private readonly loadingSignal = signal(false);
  private readonly savingSignal = signal(false);
  private readonly dirtySignal = signal(false);

  private readonly undoStackSignal = signal<HistoryStep[]>([]);
  private readonly redoStackSignal = signal<HistoryStep[]>([]);
  private currentStroke: CellChange[] | null = null;
  private shapeStart: CellPosition | null = null;
  private shapePreview: CellChange[] = [];
  private stitchStrokeValue: number | null = null;

  readonly patternId = this.patternIdSignal.asReadonly();
  readonly name = this.nameSignal.asReadonly();
  readonly type = this.typeSignal.asReadonly();
  readonly width = this.widthSignal.asReadonly();
  readonly height = this.heightSignal.asReadonly();
  readonly meta = this.metaSignal.asReadonly();
  readonly palette = this.paletteSignal.asReadonly();
  readonly grid = this.gridSignal.asReadonly();
  readonly progress = this.progressSignal.asReadonly();

  readonly tool = this.toolSignal.asReadonly();
  readonly selectedPaletteIndex = this.selectedPaletteIndexSignal.asReadonly();
  readonly renderMode = this.renderModeSignal.asReadonly();
  readonly zoomPercent = this.zoomPercentSignal.asReadonly();
  readonly symmetry = this.symmetrySignal.asReadonly();
  readonly stampText = this.stampTextSignal.asReadonly();
  readonly stitchMode = this.stitchModeSignal.asReadonly();
  readonly highlightIndex = this.highlightIndexSignal.asReadonly();
  readonly showCenter = this.showCenterSignal.asReadonly();

  readonly loading = this.loadingSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly dirty = this.dirtySignal.asReadonly();

  readonly canUndo = computed(() => this.undoStackSignal().length > 0);
  readonly canRedo = computed(() => this.redoStackSignal().length > 0);

  /** "Skeins" / "Drill bags" for the legend's buy column, or null when the type isn't bought by count. */
  readonly buyLabel = computed(() => {
    const type = this.typeSignal();
    if (type === 'diamond') return 'Drill bags';
    if (type === 'cross_stitch') return 'Skeins';
    return null;
  });

  readonly legendRows = computed<LegendRow[]>(() => {
    const palette = this.paletteSignal();
    const counts = new Array(palette.length).fill(0);
    const done = new Array(palette.length).fill(0);
    const progress = this.progressSignal();
    this.gridSignal().forEach((row, y) => {
      const progressRow = progress[y];
      for (let x = 0; x < row.length; x++) {
        const value = row[x];
        if (value < 0 || value >= counts.length) continue;
        counts[value]++;
        if (progressRow?.[x] === DONE) done[value]++;
      }
    });
    const type = this.typeSignal();
    const fabricCount = this.metaSignal().fabricCount;
    const strands = this.settings.strands();
    return palette.map((entry, i) => ({
      entry,
      count: counts[i],
      done: done[i],
      buy: estimateMaterial(type, counts[i], { fabricCount, strands })?.quantity,
    }));
  });

  /** Overall stitching progress across every painted cell. */
  readonly progressSummary = computed(() => {
    let total = 0;
    let done = 0;
    for (const row of this.legendRows()) {
      total += row.count;
      done += row.done ?? 0;
    }
    return { total, done, percent: total === 0 ? 0 : Math.floor((done / total) * 100) };
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
      this.renderModeSignal.set(
        pattern.type === 'diamond'
          ? 'diamond'
          : pattern.type === 'color_by_number'
            ? 'paint-by-number'
            : 'block',
      );
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
    this.progressSignal.set(this.decodeProgress(pattern));
    this.undoStackSignal.set([]);
    this.redoStackSignal.set([]);
    this.currentStroke = null;
    this.shapeStart = null;
    this.shapePreview = [];
    this.dirtySignal.set(false);
    const highlight = this.highlightIndexSignal();
    if (highlight !== null && highlight >= pattern.palette.length) {
      this.highlightIndexSignal.set(null);
    }
  }

  private decodeProgress(pattern: Pattern): Int16Array[] {
    const encoded = pattern.meta.progress;
    if (!encoded || encoded.length !== pattern.height) {
      return blankProgress(pattern.width, pattern.height);
    }
    return decodeGrid(encoded, pattern.width).map((row) =>
      row.map((v) => (v === DONE ? DONE : NOT_DONE)),
    );
  }

  // ---- view and tool settings ------------------------------------------------

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

  setSymmetry(symmetry: Symmetry): void {
    this.symmetrySignal.set(symmetry);
  }

  setStampText(text: string): void {
    this.stampTextSignal.set(text);
  }

  setStitchMode(on: boolean): void {
    this.stitchModeSignal.set(on);
  }

  /** Highlights one color on the canvas (dimming the rest); selecting it again clears the highlight. */
  toggleHighlight(index: number): void {
    this.highlightIndexSignal.update((current) => (current === index ? null : index));
  }

  clearHighlight(): void {
    this.highlightIndexSignal.set(null);
  }

  setShowCenter(show: boolean): void {
    this.showCenterSignal.set(show);
  }

  // ---- pointer input -----------------------------------------------------------

  /**
   * Entry point for every cell the canvas reports. In stitching mode a click
   * or drag marks stitches done; otherwise it dispatches on the active tool.
   * Paint/erase and shape tools receive every cell of a drag; fill, pick and
   * text only the clicked cell (the canvas doesn't emit drag moves for them).
   */
  applyTool(x: number, y: number): void {
    if (this.stitchModeSignal()) {
      this.markStitched(x, y);
      return;
    }
    const tool = this.toolSignal();
    if (isShapeTool(tool)) {
      this.dragShape(x, y);
      return;
    }
    switch (tool) {
      case 'fill':
        this.fillAt(x, y);
        return;
      case 'pick':
        this.pickAt(x, y);
        return;
      case 'text':
        this.stampTextAt(x, y);
        return;
      default:
        this.paintCell(x, y);
    }
  }

  /** Called for every cell the pointer touches during a paint/erase drag; mirrored by the symmetry setting. */
  paintCell(x: number, y: number): void {
    const target = this.toolSignal() === 'erase' ? EMPTY_CELL : this.selectedPaletteIndexSignal();
    if (target === null) return; // paint tool with no color selected yet: no-op

    const points = mirrorPoints(
      [{ x, y }],
      this.widthSignal(),
      this.heightSignal(),
      this.symmetrySignal(),
    );
    for (const point of points) this.paintOne(point.x, point.y, target);
  }

  private paintOne(x: number, y: number, target: number): void {
    const before = this.gridSignal()[y]?.[x];
    if (before === undefined || before === target) return;

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

  /**
   * Flood-fills the connected same-color region at (x, y) - and its mirror
   * images when symmetry is on - with the selected color, as one undo step.
   */
  fillAt(x: number, y: number): void {
    const target = this.selectedPaletteIndexSignal();
    if (target === null) return;
    const starts = mirrorPoints(
      [{ x, y }],
      this.widthSignal(),
      this.heightSignal(),
      this.symmetrySignal(),
    );
    let working = this.gridSignal();
    const changes: CellChange[] = [];
    for (const start of starts) {
      const fill = floodFill(working, start.x, start.y, target);
      if (fill.length === 0) continue;
      working = applyChanges(working, fill, 'after');
      changes.push(...fill);
    }
    if (changes.length === 0) return;
    this.gridSignal.set(working);
    this.pushHistory({ kind: 'cells', changes });
  }

  /** Eyedropper: selects the palette color under (x, y) and switches back to paint. Empty cells are ignored. */
  pickAt(x: number, y: number): void {
    const value = this.gridSignal()[y]?.[x];
    if (value === undefined || value === EMPTY_CELL) return;
    this.selectedPaletteIndexSignal.set(value);
    this.toolSignal.set('paint');
  }

  /** Stamps the current text (top-left at the clicked cell) in the selected color, as one undo step. */
  stampTextAt(x: number, y: number): void {
    const target = this.selectedPaletteIndexSignal();
    const text = this.stampTextSignal();
    if (target === null || text.trim().length === 0) return;
    const points = clipToGrid(textPoints(text, x, y), this.widthSignal(), this.heightSignal());
    this.commitPoints(points, target);
  }

  /**
   * Live shape preview: the first cell of a drag anchors the shape, each
   * further cell re-draws it to that corner (reverting the previous preview
   * first), and `endStroke` commits whatever is showing as one undo step.
   */
  private dragShape(x: number, y: number): void {
    const target = this.selectedPaletteIndexSignal();
    if (target === null) return;
    this.shapeStart ??= { x, y };

    let grid = this.gridSignal();
    if (this.shapePreview.length > 0) grid = applyChanges(grid, this.shapePreview, 'before');

    const raw = this.shapeCells(this.toolSignal(), this.shapeStart, { x, y });
    const points = clipToGrid(
      mirrorPoints(raw, this.widthSignal(), this.heightSignal(), this.symmetrySignal()),
      this.widthSignal(),
      this.heightSignal(),
    );
    const changes = this.changesFor(grid, points, target);
    this.shapePreview = changes;
    this.gridSignal.set(changes.length > 0 ? applyChanges(grid, changes, 'after') : grid);
  }

  private shapeCells(tool: EditorTool, a: CellPosition, b: CellPosition): CellPosition[] {
    switch (tool) {
      case 'line':
        return linePoints(a, b);
      case 'rect':
        return rectPoints(a, b, false);
      case 'rect-fill':
        return rectPoints(a, b, true);
      case 'ellipse':
        return ellipsePoints(a, b, false);
      default:
        return ellipsePoints(a, b, true);
    }
  }

  /** Marks stitches done in stitching mode. A drag sets every cell to the opposite of where it started. */
  private markStitched(x: number, y: number): void {
    const value = this.gridSignal()[y]?.[x];
    if (value === undefined || value === EMPTY_CELL) return; // nothing to stitch here
    const current = this.progressSignal()[y]?.[x] ?? NOT_DONE;
    this.stitchStrokeValue ??= current === DONE ? NOT_DONE : DONE;
    if (current === this.stitchStrokeValue) return;
    const target = this.stitchStrokeValue;
    this.progressSignal.update((rows) => {
      const next = rows.slice();
      const row = next[y].slice();
      row[x] = target;
      next[y] = row;
      return next;
    });
    this.dirtySignal.set(true);
  }

  /** Marks every stitch of one color done (e.g. "finished all the black"), or clears them again. */
  setColorStitched(paletteIndex: number, done: boolean): void {
    const grid = this.gridSignal();
    this.progressSignal.update((rows) =>
      rows.map((row, y) => {
        let next: Int16Array | null = null;
        for (let x = 0; x < row.length; x++) {
          if (grid[y][x] !== paletteIndex) continue;
          const target = done ? DONE : NOT_DONE;
          if (row[x] === target) continue;
          next ??= row.slice();
          next[x] = target;
        }
        return next ?? row;
      }),
    );
    this.dirtySignal.set(true);
  }

  resetProgress(): void {
    this.progressSignal.set(blankProgress(this.widthSignal(), this.heightSignal()));
    this.dirtySignal.set(true);
  }

  /** Closes the current drag (paint/erase stroke, shape, or stitch marking) into one undoable step. */
  endStroke(): void {
    if (this.currentStroke && this.currentStroke.length > 0) {
      this.pushHistory({ kind: 'cells', changes: this.currentStroke });
    }
    if (this.shapePreview.length > 0) {
      this.pushHistory({ kind: 'cells', changes: this.shapePreview });
    }
    this.currentStroke = null;
    this.shapeStart = null;
    this.shapePreview = [];
    this.stitchStrokeValue = null;
  }

  // ---- history -------------------------------------------------------------

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

  // ---- whole-pattern operations (snapshot undo steps) ---------------------------

  /** Rebuilds the grid at new dimensions, preserving overlapping (top-left anchored) cells. Undoable. */
  resize(newWidth: number, newHeight: number): void {
    const before = this.snapshot();
    if (before.width === newWidth && before.height === newHeight) return;
    this.commitSnapshot(before, {
      ...before,
      width: newWidth,
      height: newHeight,
      grid: resizeGrid(before.grid, before.width, newWidth, newHeight, EMPTY_CELL),
      progress: resizeGrid(before.progress, before.width, newWidth, newHeight, NOT_DONE),
    });
  }

  flipHorizontal(): void {
    const before = this.snapshot();
    this.commitSnapshot(before, {
      ...before,
      grid: flipHorizontal(before.grid),
      progress: flipHorizontal(before.progress),
    });
  }

  flipVertical(): void {
    const before = this.snapshot();
    this.commitSnapshot(before, {
      ...before,
      grid: flipVertical(before.grid),
      progress: flipVertical(before.progress),
    });
  }

  /** Rotates the whole pattern 90 degrees clockwise (width and height swap). */
  rotateClockwise(): void {
    const before = this.snapshot();
    this.commitSnapshot(before, {
      ...before,
      width: before.height,
      height: before.width,
      grid: rotateClockwise(before.grid, before.width, before.height),
      progress: rotateClockwise(before.progress, before.width, before.height),
    });
  }

  /** Recolors every stitch of one palette color with another, as one undo step. */
  replaceColor(from: number, to: number): void {
    const changes = replaceValue(this.gridSignal(), from, to);
    if (changes.length === 0) return;
    this.gridSignal.set(applyChanges(this.gridSignal(), changes, 'after'));
    this.pushHistory({ kind: 'cells', changes });
  }

  /** Drops palette colors no stitch uses, re-numbering the rest. Undoable. */
  removeUnusedColors(): void {
    const before = this.snapshot();
    const { palette, grid, remap } = compactPalette(before.palette, before.grid);
    if (palette.length === before.palette.length) return;
    this.remapSelection(remap); // before restore(), which clears out-of-range selections
    this.commitSnapshot(before, { ...before, palette, grid });
  }

  /** Removes a color from the palette entirely, erasing its stitches. Undoable. */
  deleteColor(index: number): void {
    const before = this.snapshot();
    if (index < 0 || index >= before.palette.length) return;
    const erased = applyChanges(before.grid, replaceValue(before.grid, index, EMPTY_CELL), 'after');
    // Entries after `index` shift down by one; `index` itself maps to -1.
    const remap = Int16Array.from(before.palette, (_, i) =>
      i < index ? i : i === index ? -1 : i - 1,
    );
    const palette = before.palette
      .filter((_, i) => i !== index)
      .map((entry, i) => ({ ...entry, index: i }));
    const grid = erased.map((row) => row.map((v) => (v >= 0 ? remap[v] : v)));
    this.remapSelection(remap); // before restore(), which clears out-of-range selections
    this.commitSnapshot(before, { ...before, palette, grid });
  }

  private remapSelection(remap: Int16Array): void {
    const map = (i: number | null) =>
      i === null || remap[i] === undefined || remap[i] < 0 ? null : remap[i];
    this.selectedPaletteIndexSignal.update(map);
    this.highlightIndexSignal.update(map);
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
      const progress = encodeGrid(
        this.progressSignal().map((row) => Array.from(row, (v) => (v === DONE ? DONE : null))),
      );
      const updated = await firstValueFrom(
        this.patternsApi.update(id, {
          width: this.widthSignal(),
          height: this.heightSignal(),
          palette: this.paletteSignal(),
          grid,
          meta: { progress },
        }),
      );
      this.applyPattern(updated);
    } finally {
      this.savingSignal.set(false);
    }
  }

  // ---- internals -------------------------------------------------------------

  /** Cell changes that paint `points` with `target` on `grid`, skipping cells already that color. */
  private changesFor(
    grid: readonly Int16Array[],
    points: readonly CellPosition[],
    target: number,
  ): CellChange[] {
    const seen = new Set<number>();
    const changes: CellChange[] = [];
    const width = this.widthSignal();
    for (const { x, y } of points) {
      const key = y * width + x;
      if (seen.has(key)) continue;
      seen.add(key);
      const before = grid[y][x];
      if (before !== target) changes.push({ x, y, before, after: target });
    }
    return changes;
  }

  private commitPoints(points: readonly CellPosition[], target: number): void {
    const changes = this.changesFor(this.gridSignal(), points, target);
    if (changes.length === 0) return;
    this.gridSignal.set(applyChanges(this.gridSignal(), changes, 'after'));
    this.pushHistory({ kind: 'cells', changes });
  }

  private pushHistory(step: HistoryStep): void {
    this.undoStackSignal.update((stack) => [...stack, step]);
    this.redoStackSignal.set([]);
    this.dirtySignal.set(true);
  }

  private commitSnapshot(before: PatternSnapshot, after: PatternSnapshot): void {
    this.currentStroke = null;
    this.restore(after);
    this.pushHistory({ kind: 'snapshot', before, after });
  }

  private applyStep(step: HistoryStep, side: 'before' | 'after'): void {
    if (step.kind === 'cells') {
      this.gridSignal.set(applyChanges(this.gridSignal(), step.changes, side));
    } else {
      this.restore(step[side]);
    }
  }

  private snapshot(): PatternSnapshot {
    return {
      width: this.widthSignal(),
      height: this.heightSignal(),
      grid: this.gridSignal(),
      palette: this.paletteSignal(),
      progress: this.progressSignal(),
    };
  }

  private restore(snapshot: PatternSnapshot): void {
    this.widthSignal.set(snapshot.width);
    this.heightSignal.set(snapshot.height);
    this.gridSignal.set(snapshot.grid);
    this.paletteSignal.set(snapshot.palette);
    this.progressSignal.set(snapshot.progress);
    const selected = this.selectedPaletteIndexSignal();
    if (selected !== null && selected >= snapshot.palette.length) {
      this.selectedPaletteIndexSignal.set(null);
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
