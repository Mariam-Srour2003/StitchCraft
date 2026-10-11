import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { backstitchLength, ExportResponse, isDmcColor } from '@stitchcraft/types';

import { ConfirmService } from '@app/core/dialog/confirm.service';
import { SettingsStore } from '@app/core/settings/settings.store';
import { ExportApiService } from '@app/data-access/export-api.service';
import { EditorAction, resolveShortcut, SHORTCUTS } from '@app/domain/editor/shortcuts';
import type { EditorTool } from '@app/domain/editor/tools';
import { measureText, SUPPORTED_CHARACTERS } from '@app/domain/grid/pixel-font';
import { Symmetry } from '@app/domain/grid/shapes';
import { cellNoun, physicalUnit } from '@app/domain/pattern/pattern-rules';
import { GridCanvas, GridCanvasTool } from '@app/shared/canvas/grid-canvas';
import {
  CellPosition,
  DARK_GRID_THEME,
  GridTheme,
  LIGHT_GRID_THEME,
  RenderMode,
} from '@app/shared/canvas/grid-render-math';
import { DmcThreadSearchComponent } from '@app/shared/dmc-thread-search/dmc-thread-search.component';
import { Button } from '@app/shared/ui/button/button';
import { ColorPicker } from '@app/shared/ui/color-picker/color-picker';
import { IconButton } from '@app/shared/ui/icon-button/icon-button';
import { Legend } from '@app/shared/ui/legend/legend';
import { Modal } from '@app/shared/ui/modal/modal';
import { PaletteGrid } from '@app/shared/ui/palette-grid/palette-grid';
import { Progress } from '@app/shared/ui/progress/progress';
import {
  SegmentedToggle,
  SegmentedToggleOption,
} from '@app/shared/ui/segmented-toggle/segmented-toggle';
import { SizeReadout } from '@app/shared/ui/size-readout/size-readout';
import { Slider } from '@app/shared/ui/slider/slider';
import { Toolbar } from '@app/shared/ui/toolbar/toolbar';

import { EditorStore } from './editor.store';

const DRAW_TOOLS: SegmentedToggleOption<EditorTool>[] = [
  { value: 'paint', label: 'Paint' },
  { value: 'erase', label: 'Erase' },
  { value: 'fill', label: 'Fill' },
  { value: 'pick', label: 'Pick' },
  { value: 'text', label: 'Text' },
];

const SHAPE_TOOLS: SegmentedToggleOption<EditorTool>[] = [
  { value: 'line', label: 'Line' },
  { value: 'rect', label: 'Box' },
  { value: 'rect-fill', label: 'Box ■' },
  { value: 'ellipse', label: 'Oval' },
  { value: 'ellipse-fill', label: 'Oval ●' },
];

const LINE_TOOLS: SegmentedToggleOption<EditorTool>[] = [
  { value: 'backstitch', label: 'Backstitch' },
  { value: 'backstitch-erase', label: 'Remove line' },
];

const PARTIAL_TOOLS: SegmentedToggleOption<EditorTool>[] = [
  { value: 'half-stitch', label: 'Half ⁄' },
  { value: 'quarter-stitch', label: 'Quarter ◸' },
];

const MODE_OPTIONS: SegmentedToggleOption<RenderMode>[] = [
  { value: 'x-stitch', label: 'X-Stitch' },
  { value: 'block', label: 'Block' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'symbol', label: 'Symbol' },
  { value: 'number', label: 'Number' },
  { value: 'paint-by-number', label: 'Paint #' },
];

const SYMMETRY_OPTIONS: SegmentedToggleOption<Symmetry>[] = [
  { value: 'none', label: 'Off' },
  { value: 'vertical', label: 'Left↔Right' },
  { value: 'horizontal', label: 'Top↕Bottom' },
  { value: 'both', label: 'Both' },
];

type WorkMode = 'design' | 'stitch';

const WORK_MODE_OPTIONS: SegmentedToggleOption<WorkMode>[] = [
  { value: 'design', label: 'Design' },
  { value: 'stitch', label: 'Stitch' },
];

const ZOOM_STEP = 25;

@Component({
  selector: 'sc-editor',
  standalone: true,
  imports: [
    Button,
    ColorPicker,
    DmcThreadSearchComponent,
    GridCanvas,
    IconButton,
    Legend,
    Modal,
    PaletteGrid,
    Progress,
    SegmentedToggle,
    SizeReadout,
    Slider,
    Toolbar,
  ],
  providers: [EditorStore],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent {
  /** Bound from the `:id` route param via withComponentInputBinding(). */
  readonly id = input.required<string>();
  /** Optional `?mode=stitch` query param (also bound via withComponentInputBinding) opens straight into stitching mode. */
  readonly mode = input<string | undefined>(undefined);

  protected readonly store = inject(EditorStore);
  private readonly confirmer = inject(ConfirmService);
  private readonly exportApi = inject(ExportApiService);
  private readonly settings = inject(SettingsStore);

  /** Canvas theme from Settings; null lets the canvas follow the OS light/dark setting. */
  protected readonly canvasTheme = computed<GridTheme | null>(() => {
    const preference = this.settings.canvasTheme();
    return preference === 'light'
      ? LIGHT_GRID_THEME
      : preference === 'dark'
        ? DARK_GRID_THEME
        : null;
  });

  protected readonly drawTools = DRAW_TOOLS;
  protected readonly shapeTools = SHAPE_TOOLS;
  protected readonly lineTools = LINE_TOOLS;
  protected readonly partialTools = PARTIAL_TOOLS;
  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly symmetryOptions = SYMMETRY_OPTIONS;
  protected readonly workModeOptions = WORK_MODE_OPTIONS;
  protected readonly shortcuts = SHORTCUTS;
  /** The font's non-alphanumeric characters, listed as a hint under the lettering box. */
  protected readonly cellNoun = cellNoun;
  protected readonly lettering = SUPPORTED_CHARACTERS.replace(/[A-Z0-9 ]/g, '');

  protected readonly unitSize = computed(() =>
    physicalUnit(this.store.type(), this.store.meta(), {
      fabricCount: this.settings.fabricCount(),
      drillSizeMm: this.settings.drillSizeMm(),
    }),
  );

  protected readonly paletteDmcCodes = computed(() =>
    this.store.palette().flatMap((entry) => (isDmcColor(entry.color) ? [entry.color.code] : [])),
  );

  protected readonly workMode = computed<WorkMode>(() =>
    this.store.stitchMode() ? 'stitch' : 'design',
  );

  /** What the canvas should treat pointer input as (cursor + click-vs-drag behaviour). */
  protected readonly canvasTool = computed<GridCanvasTool>(() =>
    this.store.stitchMode() ? 'stitch' : this.store.tool(),
  );

  protected readonly selectedEntry = computed(() => {
    const index = this.store.selectedPaletteIndex();
    return index === null ? null : (this.store.palette()[index] ?? null);
  });

  /** Line count and total length for the sidebar, in cm on the pattern's fabric. */
  protected readonly backstitchSummary = computed(() => {
    const lines = this.store.backstitches();
    const cells = lines.reduce((sum, line) => sum + backstitchLength(line), 0);
    const cm = Math.round((cells * 2.54) / this.unitSize());
    return { lines: lines.length, cm };
  });

  /** Half and quarter stitch counts for the sidebar. */
  protected readonly partialSummary = computed(() => {
    let halves = 0;
    let quarters = 0;
    for (const stitch of this.store.partialStitches()) {
      if (stitch.part.startsWith('half')) halves++;
      else quarters++;
    }
    return { halves, quarters, total: halves + quarters };
  });

  protected readonly stampSize = computed(() => measureText(this.store.stampText()));

  protected readonly replaceTarget = signal<number | null>(null);

  protected readonly exporting = signal(false);
  protected readonly exportResult = signal<ExportResponse | null>(null);
  protected readonly exportError = signal<string | null>(null);

  constructor() {
    effect(
      () => {
        const id = this.id();
        if (!id) return;
        const startInStitchMode = this.mode() === 'stitch';
        this.store.load(id).then(() => {
          if (startInStitchMode) this.store.setStitchMode(true);
        });
      },
      // store.load() writes several signals (loading, pattern data, default
      // render mode) after its internal await - Angular disallows signal
      // writes inside an effect by default even across a microtask boundary.
      { allowSignalWrites: true },
    );
  }

  onCellEdit(cell: CellPosition): void {
    this.store.applyTool(cell.x, cell.y);
  }

  setWorkMode(mode: WorkMode): void {
    this.store.setStitchMode(mode === 'stitch');
  }

  /** Picking a drawing tool always leaves stitching mode, so the click does what the tool says. */
  selectTool(tool: EditorTool): void {
    this.store.setTool(tool);
    this.store.setStitchMode(false);
  }

  applyResize(widthValue: string, heightValue: string): void {
    const width = Math.max(1, Math.round(Number(widthValue)));
    const height = Math.max(1, Math.round(Number(heightValue)));
    if (Number.isFinite(width) && Number.isFinite(height)) {
      this.store.resize(width, height);
    }
  }

  onReplaceTargetChange(value: string): void {
    this.replaceTarget.set(value === '' ? null : Number(value));
  }

  applyReplace(): void {
    const from = this.store.selectedPaletteIndex();
    const to = this.replaceTarget();
    if (from === null || to === null || from === to) return;
    this.store.replaceColor(from, to);
    this.replaceTarget.set(null);
  }

  deleteSelectedColor(): void {
    const index = this.store.selectedPaletteIndex();
    if (index === null) return;
    const count = this.store.legendRows()[index]?.count ?? 0;
    if (count > 0 && !this.confirmer.confirm(`Delete this color and erase its ${count} stitches?`))
      return;
    this.store.deleteColor(index);
  }

  resetProgress(): void {
    if (this.confirmer.confirm('Clear all stitching progress for this pattern?'))
      this.store.resetProgress();
  }

  save(): void {
    this.store.save();
  }

  async exportPattern(): Promise<void> {
    const patternId = this.store.patternId();
    if (!patternId) return;

    this.exporting.set(true);
    this.exportError.set(null);
    try {
      const result = await firstValueFrom(this.exportApi.create(patternId));
      this.exportResult.set(result);
    } catch {
      this.exportError.set('Could not generate the export. Please try again.');
    } finally {
      this.exporting.set(false);
    }
  }

  closeExport(): void {
    this.exportResult.set(null);
    this.exportError.set(null);
  }

  /** Used by the route's canDeactivate guard. */
  canLeave(): boolean {
    return (
      !this.store.dirty() ||
      this.confirmer.confirm('You have unsaved changes. Leave without saving?')
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.dirty()) event.preventDefault();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (isTypingTarget(event.target)) return;
    const action = resolveShortcut(event);
    if (!action) return;
    event.preventDefault();
    this.run(action);
  }

  private run(action: EditorAction): void {
    switch (action.type) {
      case 'undo':
        return this.store.undo();
      case 'redo':
        return this.store.redo();
      case 'save':
        return this.save();
      case 'tool':
        return this.selectTool(action.tool);
      case 'toggle-highlight': {
        const index = this.store.selectedPaletteIndex();
        if (index !== null) this.store.toggleHighlight(index);
        return;
      }
      case 'toggle-stitch-mode':
        return this.store.setStitchMode(!this.store.stitchMode());
      case 'zoom':
        return this.store.setZoomPercent(this.store.zoomPercent() + action.direction * ZOOM_STEP);
      case 'clear-highlight':
        return this.store.clearHighlight();
    }
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
