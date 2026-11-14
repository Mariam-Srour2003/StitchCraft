import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  assignSymbols,
  estimateMaterial,
  materialColumnLabel,
  planRareColorMerge,
  srgbToLab,
} from '@stitchcraft/color';
import {
  Backstitch,
  backstitchLengthByIndex,
  CustomColor,
  decodeGrid,
  DmcColor,
  EMPTY_CELL,
  encodeGrid,
  countDecodedCells,
  isDmcColor,
  mergeSmallRegions,
  PaletteEntry,
  PartialStitch,
  partialThreadByIndex,
  Pattern,
  remapCells,
  removeStrayStitches,
} from '@stitchcraft/types';

import { SettingsStore } from '@app/core/settings/settings.store';
import { PatternsApiService } from '@app/data-access/patterns-api.service';
import { EditorTool, isLineTool, isPartialTool, isShapeTool } from '@app/domain/editor/tools';
import { UndoHistory } from '@app/domain/editor/undo-history';
import {
  clipLines,
  flipLinesHorizontal,
  flipLinesVertical,
  nearestLine,
  recolorLines,
  remapLines,
  rotateLinesClockwise,
  sameLine,
  usedLineColors,
} from '@app/domain/grid/backstitch';
import type { CellPosition } from '@app/domain/grid/cell';
import {
  applyChanges,
  CellChange,
  compactPalette,
  flipHorizontal,
  flipVertical,
  floodFill,
  replaceValue,
  resizeGrid,
  rotateClockwise,
} from '@app/domain/grid/grid-ops';
import {
  clipPartials,
  flipPartialsHorizontal,
  flipPartialsVertical,
  partAt,
  placePartial,
  recolorPartials,
  remapPartials,
  removePartialsInCells,
  rotatePartialsClockwise,
  usedPartialColors,
} from '@app/domain/grid/partial-stitches';
import { textPoints } from '@app/domain/grid/pixel-font';
import { RowTally } from '@app/domain/grid/row-tally';
import {
  clipToGrid,
  ellipsePoints,
  linePoints,
  mirrorPoints,
  rectPoints,
  Symmetry,
} from '@app/domain/grid/shapes';
import { defaultRenderMode, RenderMode } from '@app/domain/pattern/pattern-rules';
import {
  blankProgress,
  decodeProgress,
  DONE,
  encodeProgress,
  NOT_DONE,
} from '@app/domain/pattern/progress';
import { LegendRow } from '@app/shared/ui/legend/legend';

export type { EditorTool };

/** Everything a whole-pattern operation (resize, flip, rotate, palette clean-up) can change. */
interface PatternSnapshot {
  width: number;
  height: number;
  grid: Int16Array[];
  palette: PaletteEntry[];
  progress: Int16Array[];
  backstitches: Backstitch[];
  partialStitches: readonly PartialStitch[];
}

/** A change to the partial stitches, carried by the step that made it. */
interface PartialsChange {
  before: readonly PartialStitch[];
  after: readonly PartialStitch[];
}

/**
 * One undoable step: a set of cell edits (a paint/erase drag, a fill, a
 * shape, stamped text, a recolor), or a before/after snapshot for operations
 * that change dimensions or the palette. Snapshots hold row references,
 * which is cheap because rows are never mutated in place.
 */
type HistoryStep =
  /** Cell edits; painting or erasing over half/quarter stitches also removes them (`partials`). */
  | { kind: 'cells'; changes: CellChange[]; partials?: PartialsChange }
  | { kind: 'lines'; before: Backstitch[]; after: Backstitch[] }
  | { kind: 'snapshot'; before: PatternSnapshot; after: PatternSnapshot };

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
  private readonly backstitchesSignal = signal<Backstitch[]>([]);
  private readonly partialsSignal = signal<readonly PartialStitch[]>([]);

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

  private readonly history = new UndoHistory<HistoryStep>();
  /** Bumped on every history change so canUndo/canRedo stay reactive. */
  private readonly historyVersion = signal(0);
  private readonly tally = new RowTally();
  /** The current paint/erase drag, keyed by cell (y * width + x) for O(1) lookups on long strokes. */
  private currentStroke: Map<number, CellChange> | null = null;
  private shapeStart: CellPosition | null = null;
  private shapePreview: CellChange[] = [];
  private stitchStrokeValue: number | null = null;
  /** Partial stitches as they were before the current paint/erase drag removed any. */
  private strokePartialsBefore: readonly PartialStitch[] | null = null;

  readonly patternId = this.patternIdSignal.asReadonly();
  readonly name = this.nameSignal.asReadonly();
  readonly type = this.typeSignal.asReadonly();
  readonly width = this.widthSignal.asReadonly();
  readonly height = this.heightSignal.asReadonly();
  readonly meta = this.metaSignal.asReadonly();
  readonly palette = this.paletteSignal.asReadonly();
  readonly grid = this.gridSignal.asReadonly();
  readonly progress = this.progressSignal.asReadonly();
  readonly backstitches = this.backstitchesSignal.asReadonly();
  readonly partialStitches = this.partialsSignal.asReadonly();

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

  readonly canUndo = computed(() => this.historyVersion() >= 0 && this.history.canUndo);
  readonly canRedo = computed(() => this.historyVersion() >= 0 && this.history.canRedo);

  /** "Skeins" / "Drill bags" for the legend's buy column, or null when the type isn't bought by count. */
  readonly buyLabel = computed(() => materialColumnLabel(this.typeSignal()));

  readonly legendRows = computed<LegendRow[]>(() => {
    const palette = this.paletteSignal();
    const { counts, done } = this.tally.tally(
      this.gridSignal(),
      this.progressSignal(),
      palette.length,
    );
    const type = this.typeSignal();
    const fabricCount = this.metaSignal().fabricCount;
    const strands = this.settings.strands();
    const lineLengths = backstitchLengthByIndex(this.backstitchesSignal(), palette.length);
    const partials = partialThreadByIndex(this.partialsSignal(), palette.length);
    return palette.map((entry, i) => ({
      entry,
      count: counts[i],
      done: done[i],
      buy: estimateMaterial(type, counts[i], {
        fabricCount,
        strands,
        backstitchLength: lineLengths[i],
        partialStitches: partials[i],
      })?.quantity,
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
      this.renderModeSignal.set(defaultRenderMode(pattern.type, 'edit'));
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
    this.progressSignal.set(decodeProgress(pattern.meta.progress, pattern.width, pattern.height));
    this.backstitchesSignal.set(pattern.meta.backstitches ?? []);
    this.partialsSignal.set(pattern.meta.partialStitches ?? []);
    this.history.clear();
    this.historyVersion.update((v) => v + 1);
    this.currentStroke = null;
    this.strokePartialsBefore = null;
    this.shapeStart = null;
    this.shapePreview = [];
    this.dirtySignal.set(false);
    const highlight = this.highlightIndexSignal();
    if (highlight !== null && highlight >= pattern.palette.length) {
      this.highlightIndexSignal.set(null);
    }
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
    // line tools act on corners (addBackstitch / removeBackstitchAt), partial
    // tools on points inside a cell (placePartialAt)
    if (isLineTool(tool) || isPartialTool(tool)) return;
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
    this.paintPoints(points, target);
  }

  /**
   * Paints a batch of cells (one pointer move, plus its mirror images) as a
   * single grid update, recording each cell's original value in the current
   * stroke so the whole drag undoes as one step.
   */
  private paintPoints(points: readonly CellPosition[], target: number): void {
    const width = this.widthSignal();
    const changes = this.changesFor(this.gridSignal(), points, target);
    if (changes.length > 0) {
      const stroke = (this.currentStroke ??= new Map());
      for (const change of changes) {
        const key = change.y * width + change.x;
        const existing = stroke.get(key);
        // Touched twice in one drag: keep the original `before`, update `after`.
        if (existing) existing.after = target;
        else stroke.set(key, { ...change });
      }
      this.gridSignal.set(applyChanges(this.gridSignal(), changes, 'after'));
    }
    // A full stitch (or erasing) replaces any half/quarter stitches in those
    // cells - even when the cell itself was already that colour or empty.
    const partials = this.partialsSignal();
    const cleared = removePartialsInCells(
      partials,
      new Set(points.map((p) => p.y * width + p.x)),
      width,
    );
    if (cleared !== partials) {
      this.strokePartialsBefore ??= partials;
      this.partialsSignal.set(cleared);
    }
    if (changes.length > 0 || cleared !== partials) this.dirtySignal.set(true);
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
    const partials = this.strokePartialsBefore
      ? { before: this.strokePartialsBefore, after: this.partialsSignal() }
      : undefined;
    if ((this.currentStroke && this.currentStroke.size > 0) || partials) {
      this.pushHistory({
        kind: 'cells',
        changes: [...(this.currentStroke?.values() ?? [])],
        ...(partials ? { partials } : {}),
      });
    }
    if (this.shapePreview.length > 0) {
      this.pushHistory({ kind: 'cells', changes: this.shapePreview });
    }
    this.currentStroke = null;
    this.strokePartialsBefore = null;
    this.shapeStart = null;
    this.shapePreview = [];
    this.stitchStrokeValue = null;
  }

  // ---- backstitch -----------------------------------------------------------

  /**
   * Adds a backstitch between two grid corners in the selected color, as one
   * undo step. Redrawing an existing line in a new color recolors it; a
   * zero-length line or an exact duplicate is ignored.
   */
  addBackstitch(from: CellPosition, to: CellPosition): void {
    const paletteIndex = this.selectedPaletteIndexSignal();
    if (paletteIndex === null || (from.x === to.x && from.y === to.y)) return;
    const line: Backstitch = { x1: from.x, y1: from.y, x2: to.x, y2: to.y, paletteIndex };
    const before = this.backstitchesSignal();
    const existing = before.findIndex((l) => sameLine(l, line));
    if (existing >= 0 && before[existing].paletteIndex === paletteIndex) return;
    const after =
      existing >= 0
        ? before.map((l, i) => (i === existing ? { ...l, paletteIndex } : l))
        : [...before, line];
    this.commitLines(before, after);
  }

  /** Removes the backstitch nearest a point (fractional cells), if one is within half a cell. */
  removeBackstitchAt(fx: number, fy: number): void {
    const before = this.backstitchesSignal();
    const index = nearestLine(before, fx, fy);
    if (index < 0) return;
    this.commitLines(
      before,
      before.filter((_, i) => i !== index),
    );
  }

  private commitLines(before: Backstitch[], after: Backstitch[]): void {
    this.backstitchesSignal.set(after);
    this.pushHistory({ kind: 'lines', before, after });
  }

  // ---- half and quarter stitches ----------------------------------------------

  /**
   * Places a half or quarter stitch (by the active tool) in the selected
   * colour at a point given in fractional cells. Overlapping parts in that
   * cell are replaced, and a full stitch there is removed - one undo step.
   * Placing exactly the same stitch again removes it.
   */
  placePartialAt(fx: number, fy: number): void {
    const tool = this.toolSignal();
    const paletteIndex = this.selectedPaletteIndexSignal();
    // Partial stitches are a cross-stitch technique; drills and paint have no halves.
    if (!isPartialTool(tool) || paletteIndex === null || this.typeSignal() !== 'cross_stitch') {
      return;
    }
    const at = partAt(
      fx,
      fy,
      tool === 'half-stitch' ? 'half' : 'quarter',
      this.widthSignal(),
      this.heightSignal(),
    );
    if (!at) return;
    const before = this.partialsSignal();
    const stitch: PartialStitch = { ...at, paletteIndex };
    const after = placePartial(before, stitch);
    const added = after.includes(stitch); // false when this click removed the same stitch
    const full = this.gridSignal()[at.y][at.x];
    const changes: CellChange[] =
      added && full !== EMPTY_CELL ? [{ x: at.x, y: at.y, before: full, after: EMPTY_CELL }] : [];
    if (changes.length > 0) this.gridSignal.set(applyChanges(this.gridSignal(), changes, 'after'));
    this.partialsSignal.set(after);
    this.pushHistory({ kind: 'cells', changes, partials: { before, after } });
  }

  // ---- tidy (mostly for patterns made from photos) ------------------------------

  /**
   * Recolours every lone "confetti" stitch (no same-colour neighbour) to the
   * colour most of its neighbours have, as one undo step. Returns how many
   * stitches changed.
   */
  removeStrayStitches(): number {
    const before = this.gridSignal();
    return this.commitRows(before, removeStrayStitches(before).rows);
  }

  /**
   * Paint by number: repaints areas smaller than `minCells` with the colour
   * of the neighbour they share the longest border with. One undo step;
   * returns how many areas were merged.
   */
  mergeSmallAreas(minCells: number): number {
    const before = this.gridSignal();
    const { rows, merged } = mergeSmallRegions(before, Math.max(1, Math.round(minCells)));
    this.commitRows(before, rows);
    return merged;
  }

  /**
   * Folds every colour used for fewer than `minCells` stitches into the
   * closest (CIEDE2000) colour that is used more, then drops the emptied
   * colours - one undo step. Colours also used by backstitch or partial
   * stitches keep those, so they stay in the palette. Returns how many
   * colours were merged.
   */
  mergeRareColors(minCells: number): number {
    const before = this.snapshot();
    const counts = countDecodedCells(before.grid, before.palette.length);
    const labs = before.palette.map((entry) => srgbToLab(entry.color.rgb));
    const plan = planRareColorMerge(labs, counts, Math.max(1, Math.round(minCells)));
    const merged = plan.filter((target, index) => target !== index).length;
    if (merged === 0) return 0;
    const grid = remapCells(before.grid, plan);
    const {
      palette,
      grid: compactGrid,
      remap,
    } = compactPalette(
      before.palette,
      grid,
      new Set([
        ...usedLineColors(before.backstitches),
        ...usedPartialColors(before.partialStitches),
      ]),
    );
    this.remapSelection(remap); // before restore(), which clears out-of-range selections
    this.commitSnapshot(before, {
      ...before,
      palette,
      grid: compactGrid,
      backstitches: remapLines(before.backstitches, remap),
      partialStitches: remapPartials(before.partialStitches, remap),
    });
    return merged;
  }

  /** Records the difference between two grids (rows compared by reference) as one cell step. */
  private commitRows(before: readonly Int16Array[], after: readonly Int16Array[]): number {
    const changes: CellChange[] = [];
    after.forEach((row, y) => {
      if (row === before[y]) return;
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== before[y][x]) changes.push({ x, y, before: before[y][x], after: row[x] });
      }
    });
    if (changes.length === 0) return 0;
    this.gridSignal.set(applyChanges(this.gridSignal(), changes, 'after'));
    this.pushHistory({ kind: 'cells', changes });
    return changes.length;
  }

  // ---- history -------------------------------------------------------------

  undo(): void {
    const step = this.history.undo();
    if (!step) return;
    this.applyStep(step, 'before');
    this.historyChanged();
  }

  redo(): void {
    const step = this.history.redo();
    if (!step) return;
    this.applyStep(step, 'after');
    this.historyChanged();
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
      backstitches: clipLines(before.backstitches, newWidth, newHeight),
      partialStitches: clipPartials(before.partialStitches, newWidth, newHeight),
    });
  }

  flipHorizontal(): void {
    const before = this.snapshot();
    this.commitSnapshot(before, {
      ...before,
      grid: flipHorizontal(before.grid),
      progress: flipHorizontal(before.progress),
      backstitches: flipLinesHorizontal(before.backstitches, before.width),
      partialStitches: flipPartialsHorizontal(before.partialStitches, before.width),
    });
  }

  flipVertical(): void {
    const before = this.snapshot();
    this.commitSnapshot(before, {
      ...before,
      grid: flipVertical(before.grid),
      progress: flipVertical(before.progress),
      backstitches: flipLinesVertical(before.backstitches, before.height),
      partialStitches: flipPartialsVertical(before.partialStitches, before.height),
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
      backstitches: rotateLinesClockwise(before.backstitches, before.height),
      partialStitches: rotatePartialsClockwise(before.partialStitches, before.height),
    });
  }

  /** Recolors every stitch (backstitch and partial stitches too) of one palette color with another, as one undo step. */
  replaceColor(from: number, to: number): void {
    const changes = replaceValue(this.gridSignal(), from, to);
    const linesChange =
      this.backstitchesSignal().some((l) => l.paletteIndex === from) ||
      this.partialsSignal().some((s) => s.paletteIndex === from);
    if (changes.length === 0 && !linesChange) return;
    if (!linesChange) {
      this.gridSignal.set(applyChanges(this.gridSignal(), changes, 'after'));
      this.pushHistory({ kind: 'cells', changes });
      return;
    }
    const before = this.snapshot();
    this.commitSnapshot(before, {
      ...before,
      grid: applyChanges(before.grid, changes, 'after'),
      backstitches: recolorLines(before.backstitches, from, to),
      partialStitches: recolorPartials(before.partialStitches, from, to),
    });
  }

  /** Drops palette colors no stitch uses, re-numbering the rest. Undoable. */
  removeUnusedColors(): void {
    const before = this.snapshot();
    const { palette, grid, remap } = compactPalette(
      before.palette,
      before.grid,
      new Set([
        ...usedLineColors(before.backstitches),
        ...usedPartialColors(before.partialStitches),
      ]),
    );
    if (palette.length === before.palette.length) return;
    this.remapSelection(remap); // before restore(), which clears out-of-range selections
    this.commitSnapshot(before, {
      ...before,
      palette,
      grid,
      backstitches: remapLines(before.backstitches, remap),
      partialStitches: remapPartials(before.partialStitches, remap),
    });
  }

  /** Removes a color from the palette entirely, erasing its stitches and lines. Undoable. */
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
    this.commitSnapshot(before, {
      ...before,
      palette,
      grid,
      backstitches: remapLines(before.backstitches, remap),
      partialStitches: remapPartials(before.partialStitches, remap),
    });
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
      const progress = encodeProgress(this.progressSignal());
      const updated = await firstValueFrom(
        this.patternsApi.update(id, {
          width: this.widthSignal(),
          height: this.heightSignal(),
          palette: this.paletteSignal(),
          grid,
          meta: {
            progress,
            backstitches: this.backstitchesSignal(),
            partialStitches: [...this.partialsSignal()],
          },
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
    this.history.push(step);
    this.historyChanged();
  }

  private historyChanged(): void {
    this.historyVersion.update((v) => v + 1);
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
      if (step.partials) this.partialsSignal.set(step.partials[side]);
    } else if (step.kind === 'lines') {
      this.backstitchesSignal.set(step[side]);
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
      backstitches: this.backstitchesSignal(),
      partialStitches: this.partialsSignal(),
    };
  }

  private restore(snapshot: PatternSnapshot): void {
    this.widthSignal.set(snapshot.width);
    this.heightSignal.set(snapshot.height);
    this.gridSignal.set(snapshot.grid);
    this.paletteSignal.set(snapshot.palette);
    this.progressSignal.set(snapshot.progress);
    this.backstitchesSignal.set(snapshot.backstitches);
    this.partialsSignal.set(snapshot.partialStitches);
    const selected = this.selectedPaletteIndexSignal();
    if (selected !== null && selected >= snapshot.palette.length) {
      this.selectedPaletteIndexSignal.set(null);
    }
  }
}
