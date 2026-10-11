import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ExportResponse, isDmcColor } from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { GridCanvas, GridCanvasTool } from '../../shared/canvas/grid-canvas';
import {
  CellPosition,
  DARK_GRID_THEME,
  GridTheme,
  LIGHT_GRID_THEME,
  RenderMode,
} from '../../shared/canvas/grid-render-math';
import { SettingsStore } from '../../core/settings/settings.store';
import { Button } from '../../shared/ui/button/button';
import { ColorPicker } from '../../shared/ui/color-picker/color-picker';
import { IconButton } from '../../shared/ui/icon-button/icon-button';
import { Legend } from '../../shared/ui/legend/legend';
import { Modal } from '../../shared/ui/modal/modal';
import { PaletteGrid } from '../../shared/ui/palette-grid/palette-grid';
import { Progress } from '../../shared/ui/progress/progress';
import {
  SegmentedToggle,
  SegmentedToggleOption,
} from '../../shared/ui/segmented-toggle/segmented-toggle';
import { SizeReadout } from '../../shared/ui/size-readout/size-readout';
import { Slider } from '../../shared/ui/slider/slider';
import { Toolbar } from '../../shared/ui/toolbar/toolbar';
import { DmcThreadSearchComponent } from './dmc-thread-search.component';
import { EditorStore, EditorTool } from './editor.store';
import { ExportApiService } from './export-api.service';
import { SUPPORTED_CHARACTERS, measureText } from './pixel-font';
import { Symmetry } from './shapes';
import { SHORTCUTS } from './shortcuts';

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

/** Single-key tool shortcuts (no modifier). */
const TOOL_KEYS: Record<string, EditorTool> = {
  b: 'paint',
  e: 'erase',
  g: 'fill',
  i: 'pick',
  t: 'text',
  l: 'line',
  r: 'rect',
  o: 'ellipse',
};

const DEFAULT_FABRIC_COUNT = 14;
const DEFAULT_DRILL_SIZE_MM = 2.8;
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
  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly symmetryOptions = SYMMETRY_OPTIONS;
  protected readonly workModeOptions = WORK_MODE_OPTIONS;
  protected readonly shortcuts = SHORTCUTS;
  /** The font's non-alphanumeric characters, listed as a hint under the lettering box. */
  protected readonly lettering = SUPPORTED_CHARACTERS.replace(/[A-Z0-9 ]/g, '');

  protected readonly unitSize = computed(() =>
    this.store.type() === 'diamond'
      ? (this.store.meta().drillSizeMm ?? DEFAULT_DRILL_SIZE_MM)
      : (this.store.meta().fabricCount ?? DEFAULT_FABRIC_COUNT),
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
    if (count > 0 && !confirm(`Delete this color and erase its ${count} stitches?`)) return;
    this.store.deleteColor(index);
  }

  resetProgress(): void {
    if (confirm('Clear all stitching progress for this pattern?')) this.store.resetProgress();
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
    return !this.store.dirty() || confirm('You have unsaved changes. Leave without saving?');
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.dirty()) event.preventDefault();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (isTypingTarget(event.target)) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (mod) {
      if (key === 'z' && !event.shiftKey) {
        this.store.undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        this.store.redo();
      } else if (key === 's') {
        this.save();
      } else {
        return;
      }
      event.preventDefault();
      return;
    }
    if (event.altKey) return;

    if (TOOL_KEYS[key]) {
      this.selectTool(TOOL_KEYS[key]);
    } else if (key === 'h') {
      const index = this.store.selectedPaletteIndex();
      if (index !== null) this.store.toggleHighlight(index);
    } else if (key === 'k') {
      this.store.setStitchMode(!this.store.stitchMode());
    } else if (key === '+' || key === '=') {
      this.store.setZoomPercent(this.store.zoomPercent() + ZOOM_STEP);
    } else if (key === '-' || key === '_') {
      this.store.setZoomPercent(this.store.zoomPercent() - ZOOM_STEP);
    } else if (key === 'escape') {
      this.store.clearHighlight();
    } else {
      return;
    }
    event.preventDefault();
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
