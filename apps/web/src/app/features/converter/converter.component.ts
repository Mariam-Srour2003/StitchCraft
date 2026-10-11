import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  InjectionToken,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  catchError,
  debounce,
  from,
  interval,
  map,
  of,
  Subject,
  switchMap,
  takeWhile,
  timer,
} from 'rxjs';

import {
  AdviceFix,
  AnalyzeImageParams,
  ImageAnalysis,
  MAX_PATTERN_DIMENSION,
  PatternType,
  RelativeBox,
} from '@stitchcraft/types';

import { encodeJpeg, loadImageFile } from '@app/core/browser/image-io';
import { ConversionsApiService } from '@app/data-access/conversions-api.service';
import {
  applyEdits,
  applyPreview,
  centeredBox,
  composeCrop,
  downscale,
  editedAspect,
  hasEdits,
  NO_EDITS,
  PhotoAdjustments,
  PhotoEdits,
  RgbaImage,
  Rotation,
} from '@app/domain/image/image-ops';
import { Button } from '@app/shared/ui/button/button';
import { FileDrop } from '@app/shared/ui/file-drop/file-drop';
import { IconButton } from '@app/shared/ui/icon-button/icon-button';
import { Progress } from '@app/shared/ui/progress/progress';
import {
  SegmentedToggle,
  SegmentedToggleOption,
} from '@app/shared/ui/segmented-toggle/segmented-toggle';
import { Slider } from '@app/shared/ui/slider/slider';

import { AdviceState, PhotoAdvice } from './photo-advice/photo-advice';
import { FaceMarker, PhotoCropper } from './photo-cropper/photo-cropper';

const TARGET_TYPE_OPTIONS: SegmentedToggleOption<PatternType>[] = [
  { value: 'cross_stitch', label: 'Cross-Stitch' },
  { value: 'color_by_number', label: 'Color by Number' },
  { value: 'diamond', label: 'Diamond' },
];

type CropShape = 'free' | 'square' | 'landscape' | 'portrait';
const CROP_SHAPE_OPTIONS: SegmentedToggleOption<CropShape>[] = [
  { value: 'free', label: 'Free' },
  { value: 'square', label: 'Square' },
  { value: 'landscape', label: '4:3' },
  { value: 'portrait', label: '3:4' },
];
const CROP_ASPECT: Record<CropShape, number | null> = {
  free: null,
  square: 1,
  landscape: 4 / 3,
  portrait: 3 / 4,
};

type PreviewMode = 'photo' | 'pattern';
const PREVIEW_OPTIONS: SegmentedToggleOption<PreviewMode>[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'pattern', label: 'Pattern preview' },
];

export const POLL_INTERVAL_MS = 1200;

/** How long settings must sit still before the photo is re-checked. */
export const ANALYSIS_DEBOUNCE_MS = new InjectionToken<number>('ANALYSIS_DEBOUNCE_MS', {
  factory: () => 700,
});

/** Edited photos are converted from a copy this big (long side): 4+ px per stitch at the 500 max. */
const WORKING_SIZE = 2000;
/** On-screen copy, kept small so sliders stay smooth. */
const DISPLAY_SIZE = 900;
/** Uploads above this are re-encoded from the working copy (the API accepts up to 15 MB). */
const MAX_ORIGINAL_UPLOAD = 12 * 1024 * 1024;

type ConverterPhase = 'select' | 'loading' | 'configure' | 'converting' | 'failed';

const clampDimension = (n: number) =>
  Math.max(1, Math.min(MAX_PATTERN_DIMENSION, Math.round(n) || 1));

@Component({
  selector: 'sc-converter',
  standalone: true,
  imports: [
    Button,
    FileDrop,
    IconButton,
    PhotoAdvice,
    PhotoCropper,
    Progress,
    SegmentedToggle,
    Slider,
  ],
  templateUrl: './converter.component.html',
  styleUrl: './converter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConverterComponent {
  readonly projectId = input.required<string>();

  private readonly conversionsApi = inject(ConversionsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly analysisDebounceMs = inject(ANALYSIS_DEBOUNCE_MS);

  protected readonly targetTypeOptions = TARGET_TYPE_OPTIONS;
  protected readonly cropShapeOptions = CROP_SHAPE_OPTIONS;
  protected readonly previewOptions = PREVIEW_OPTIONS;
  protected readonly maxDimension = MAX_PATTERN_DIMENSION;

  protected readonly phase = signal<ConverterPhase>('select');
  protected readonly selectedFile = signal<File | null>(null);
  /** Decoded photo (upright), up to WORKING_SIZE. */
  private readonly working = signal<RgbaImage | null>(null);
  /** Smaller copy for the screen. */
  private readonly display = signal<RgbaImage | null>(null);

  protected readonly edits = signal<PhotoEdits>(NO_EDITS);
  protected readonly cropShape = signal<CropShape>('free');
  protected readonly previewMode = signal<PreviewMode>('photo');

  protected readonly targetType = signal<PatternType>('cross_stitch');
  protected readonly width = signal(60);
  protected readonly height = signal(60);
  protected readonly keepProportions = signal(true);
  protected readonly colorCount = signal(24);
  protected readonly enhance = signal(false);
  protected readonly cleanup = signal(true);

  protected readonly analysis = signal<ImageAnalysis | null>(null);
  protected readonly analysisState = signal<AdviceState>('idle');
  /** The crop the current analysis was made on - face boxes are relative to it. */
  private analyzedCrop: RelativeBox | null = null;
  private readonly analysisRequests = new Subject<void>();

  protected readonly progress = signal(0);
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');

  /** Rotated, flipped and adjusted (not cropped) - what the crop box is drawn over. */
  protected readonly previewImage = computed(() => {
    const display = this.display();
    return display ? applyPreview(display, this.edits()) : null;
  });

  protected readonly cropAspect = computed(() => CROP_ASPECT[this.cropShape()]);

  /** Faces from the last photo check, mapped onto the uncropped photo. */
  protected readonly faceMarkers = computed<FaceMarker[]>(() => {
    const analysis = this.analysis();
    if (!analysis || this.analysisState() !== 'ready') return [];
    return analysis.faces.map((face) => ({
      box: composeCrop(this.analyzedCrop, face.box),
      label: `${face.stitchHeight} st`,
      tone: face.stitchHeight >= 18 ? 'good' : face.stitchHeight >= 10 ? 'warning' : 'problem',
    }));
  });

  protected readonly adjustments = computed(() => this.edits().adjust);
  protected readonly isEdited = computed(() => hasEdits(this.edits()));

  /** One cached upload per set of edits, so checking and converting reuse it. */
  private uploadCache: { edits: PhotoEdits; blob: Promise<Blob> } | null = null;

  constructor() {
    this.analysisRequests
      .pipe(
        debounce(() => timer(this.analysisDebounceMs)),
        switchMap(() => {
          const file = this.selectedFile();
          if (!file) return of(null);
          const crop = this.edits().crop;
          const params = this.conversionParams();
          return from(this.photoForUpload()).pipe(
            switchMap((blob) => this.conversionsApi.analyze(blob, params)),
            map((analysis) => ({ analysis, crop })),
            catchError(() => of('error' as const)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result === null) return;
        if (result === 'error') {
          this.analysisState.set('error');
          return;
        }
        this.analyzedCrop = result.crop;
        this.analysis.set(result.analysis);
        this.analysisState.set('ready');
      });
  }

  // --- photo ---------------------------------------------------------------

  async onFilesSelected(files: File[]): Promise<void> {
    const file = files[0];
    if (!file) return;
    this.phase.set('loading');
    try {
      const working = await loadImageFile(file, WORKING_SIZE);
      this.selectedFile.set(file);
      this.working.set(working);
      this.display.set(downscale(working, DISPLAY_SIZE));
      this.edits.set(NO_EDITS);
      this.cropShape.set('free');
      this.previewMode.set('photo');
      this.analysis.set(null);
      this.uploadCache = null;
      this.syncHeight();
      this.phase.set('configure');
      this.requestAnalysis();
    } catch {
      this.errorMessage.set("That file couldn't be opened as an image. Try a PNG, JPG or WebP.");
      this.phase.set('failed');
    }
  }

  reset(): void {
    this.selectedFile.set(null);
    this.working.set(null);
    this.display.set(null);
    this.edits.set(NO_EDITS);
    this.analysis.set(null);
    this.analysisState.set('idle');
    this.uploadCache = null;
    this.progress.set(0);
    this.errorMessage.set('');
    this.phase.set('select');
  }

  rotate(by: 90 | -90): void {
    // A rotated crop box no longer frames the same thing; start the crop over.
    this.updateEdits((e) => ({
      ...e,
      rotation: ((((e.rotation + by) % 360) + 360) % 360) as Rotation,
      crop: null,
    }));
  }

  flip(axis: 'h' | 'v'): void {
    this.updateEdits((e) => {
      const crop = e.crop;
      const mirrored =
        crop &&
        (axis === 'h'
          ? { ...crop, x: 1 - crop.x - crop.width }
          : { ...crop, y: 1 - crop.y - crop.height });
      return axis === 'h'
        ? { ...e, flipH: !e.flipH, crop: mirrored }
        : { ...e, flipV: !e.flipV, crop: mirrored };
    });
  }

  setCrop(crop: RelativeBox | null): void {
    this.updateEdits((e) => ({ ...e, crop }));
  }

  setCropShape(shape: CropShape): void {
    this.cropShape.set(shape);
    const aspect = CROP_ASPECT[shape];
    const image = this.previewImage();
    if (aspect && image) this.setCrop(centeredBox(aspect, image.width / image.height));
  }

  setAdjustment(key: keyof PhotoAdjustments, value: number): void {
    this.updateEdits((e) => ({ ...e, adjust: { ...e.adjust, [key]: value } }));
  }

  resetEdits(): void {
    this.cropShape.set('free');
    this.updateEdits(() => NO_EDITS);
  }

  private updateEdits(change: (edits: PhotoEdits) => PhotoEdits): void {
    this.edits.update(change);
    this.syncHeight();
    this.requestAnalysis();
  }

  // --- settings ----------------------------------------------------------------

  setTargetType(type: PatternType): void {
    this.targetType.set(type);
    this.requestAnalysis();
  }

  setWidth(value: number): void {
    this.width.set(clampDimension(value));
    this.syncHeight();
    this.requestAnalysis();
  }

  setHeight(value: number): void {
    this.height.set(clampDimension(value));
    if (this.keepProportions()) this.width.set(clampDimension(this.height() * this.photoAspect()));
    this.requestAnalysis();
  }

  setKeepProportions(keep: boolean): void {
    this.keepProportions.set(keep);
    this.syncHeight();
    this.requestAnalysis();
  }

  setColorCount(value: number): void {
    this.colorCount.set(value);
    this.requestAnalysis();
  }

  setEnhance(on: boolean): void {
    this.enhance.set(on);
    this.requestAnalysis();
  }

  setCleanup(on: boolean): void {
    this.cleanup.set(on);
    this.requestAnalysis();
  }

  /** Width / height of the photo as it will be converted. */
  private photoAspect(): number {
    const working = this.working();
    return working ? editedAspect(working.width, working.height, this.edits()) : 1;
  }

  /** With "keep proportions" on, height follows width and the photo's shape. */
  private syncHeight(): void {
    if (this.keepProportions()) this.height.set(clampDimension(this.width() / this.photoAspect()));
  }

  // --- advice --------------------------------------------------------------------

  applyFix(fix: AdviceFix): void {
    switch (fix.kind) {
      case 'size':
        this.width.set(clampDimension(fix.width));
        if (this.keepProportions()) this.syncHeight();
        else this.height.set(clampDimension(fix.height));
        break;
      case 'colors':
        this.colorCount.set(fix.colorCount);
        break;
      case 'enhance':
        this.enhance.set(true);
        break;
      case 'cleanup':
        this.cleanup.set(true);
        break;
      case 'crop':
        // The advisor saw the photo as currently cropped; its box is inside that.
        this.cropShape.set('free');
        this.edits.update((e) => ({ ...e, crop: composeCrop(e.crop, fix.box) }));
        this.syncHeight();
        break;
    }
    this.requestAnalysis();
  }

  applyAllSuggestions(): void {
    const analysis = this.analysis();
    if (!analysis) return;
    // Crop first: it changes the photo's shape, which the size then follows.
    const crop = analysis.advice.find((a) => a.fix?.kind === 'crop')?.fix;
    if (crop?.kind === 'crop') {
      this.cropShape.set('free');
      this.edits.update((e) => ({ ...e, crop: composeCrop(e.crop, crop.box) }));
    }
    const { suggested } = analysis;
    this.colorCount.set(suggested.colorCount);
    this.enhance.set(suggested.enhance);
    this.cleanup.set(suggested.cleanup);
    this.width.set(clampDimension(suggested.width));
    if (this.keepProportions()) this.syncHeight();
    else this.height.set(clampDimension(suggested.height));
    this.requestAnalysis();
  }

  requestAnalysis(): void {
    if (!this.selectedFile()) return;
    this.analysisState.set('loading');
    this.analysisRequests.next();
  }

  private conversionParams(): AnalyzeImageParams {
    return {
      targetType: this.targetType(),
      width: this.width(),
      height: this.height(),
      colorCount: this.colorCount(),
      enhance: this.enhance(),
      cleanup: this.cleanup(),
    };
  }

  /**
   * The photo to send: the original file when nothing was edited (full
   * quality; the API applies its EXIF rotation), otherwise the edited
   * working copy as a JPEG.
   */
  private photoForUpload(): Promise<Blob> {
    const file = this.selectedFile();
    const working = this.working();
    const edits = this.edits();
    if (!file || !working) return Promise.reject(new Error('No photo'));
    if (this.uploadCache?.edits === edits) return this.uploadCache.blob;
    const blob =
      !hasEdits(edits) && file.size <= MAX_ORIGINAL_UPLOAD
        ? Promise.resolve<Blob>(file)
        : encodeJpeg(applyEdits(working, edits));
    this.uploadCache = { edits, blob };
    return blob;
  }

  // --- convert -----------------------------------------------------------------------

  async startConversion(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.phase.set('converting');
    this.progress.set(0);
    this.statusMessage.set('Uploading…');

    let photo: Blob;
    try {
      photo = await this.photoForUpload();
    } catch {
      this.errorMessage.set('Could not prepare the photo. Please try again.');
      this.phase.set('failed');
      return;
    }

    this.conversionsApi
      .create(this.projectId(), photo, this.conversionParams(), file.name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ jobId }) => this.pollJob(jobId),
        error: () => {
          this.errorMessage.set('Could not start the conversion. Please try again.');
          this.phase.set('failed');
        },
      });
  }

  private pollJob(jobId: string): void {
    this.statusMessage.set('Converting…');

    interval(POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.conversionsApi.get(jobId)),
        takeWhile((job) => job.status === 'queued' || job.status === 'processing', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (job) => {
          this.progress.set(job.progress);
          if (job.status === 'completed' && job.resultPatternId) {
            this.router.navigate(['/editor', job.resultPatternId], {
              queryParams: { converted: 1 },
            });
          } else if (job.status === 'failed') {
            this.errorMessage.set(job.error ?? 'Conversion failed.');
            this.phase.set('failed');
          }
        },
        error: () => {
          this.errorMessage.set('Lost connection while checking conversion progress.');
          this.phase.set('failed');
        },
      });
  }
}
