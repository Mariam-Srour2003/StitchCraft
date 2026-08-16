import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { ExportResponse } from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { CellPosition, RenderMode } from '../../shared/canvas/grid-render-math';
import { GridCanvas, GridCanvasTool } from '../../shared/canvas/grid-canvas';
import { Button } from '../../shared/ui/button/button';
import { ColorPicker } from '../../shared/ui/color-picker/color-picker';
import { IconButton } from '../../shared/ui/icon-button/icon-button';
import { Legend } from '../../shared/ui/legend/legend';
import { Modal } from '../../shared/ui/modal/modal';
import { PaletteGrid } from '../../shared/ui/palette-grid/palette-grid';
import { SegmentedToggle, SegmentedToggleOption } from '../../shared/ui/segmented-toggle/segmented-toggle';
import { SizeReadout } from '../../shared/ui/size-readout/size-readout';
import { Slider } from '../../shared/ui/slider/slider';
import { Toolbar } from '../../shared/ui/toolbar/toolbar';
import { EditorStore } from './editor.store';
import { ExportApiService } from './export-api.service';

const TOOL_OPTIONS: SegmentedToggleOption<GridCanvasTool>[] = [
  { value: 'paint', label: 'Paint' },
  { value: 'erase', label: 'Erase' },
];

const MODE_OPTIONS: SegmentedToggleOption<RenderMode>[] = [
  { value: 'x-stitch', label: 'X-Stitch' },
  { value: 'block', label: 'Block' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'symbol', label: 'Symbol' },
  { value: 'number', label: 'Number' },
];

const DEFAULT_FABRIC_COUNT = 14;
const DEFAULT_DRILL_SIZE_MM = 2.8;

@Component({
  selector: 'sc-editor',
  standalone: true,
  imports: [
    Button,
    ColorPicker,
    GridCanvas,
    IconButton,
    Legend,
    Modal,
    PaletteGrid,
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

  protected readonly store = inject(EditorStore);
  private readonly exportApi = inject(ExportApiService);

  protected readonly toolOptions = TOOL_OPTIONS;
  protected readonly modeOptions = MODE_OPTIONS;

  protected readonly unitSize = computed(() =>
    this.store.type() === 'diamond'
      ? (this.store.meta().drillSizeMm ?? DEFAULT_DRILL_SIZE_MM)
      : (this.store.meta().fabricCount ?? DEFAULT_FABRIC_COUNT),
  );

  protected readonly exporting = signal(false);
  protected readonly exportResult = signal<ExportResponse | null>(null);
  protected readonly exportError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.store.load(id);
    });
  }

  onCellEdit(cell: CellPosition): void {
    this.store.paintCell(cell.x, cell.y);
  }

  applyResize(widthValue: string, heightValue: string): void {
    const width = Math.max(1, Math.round(Number(widthValue)));
    const height = Math.max(1, Math.round(Number(heightValue)));
    if (Number.isFinite(width) && Number.isFinite(height)) {
      this.store.resize(width, height);
    }
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
}
