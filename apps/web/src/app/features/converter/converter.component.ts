import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { PatternType } from '@stitchcraft/types';
import { interval, switchMap, takeWhile } from 'rxjs';
import { Button } from '../../shared/ui/button/button';
import { FileDrop } from '../../shared/ui/file-drop/file-drop';
import { Progress } from '../../shared/ui/progress/progress';
import { SegmentedToggle, SegmentedToggleOption } from '../../shared/ui/segmented-toggle/segmented-toggle';
import { Slider } from '../../shared/ui/slider/slider';
import { ConversionsApiService } from './conversions-api.service';

const TARGET_TYPE_OPTIONS: SegmentedToggleOption<PatternType>[] = [
  { value: 'cross_stitch', label: 'Cross-Stitch' },
  { value: 'color_by_number', label: 'Color by Number' },
  { value: 'diamond', label: 'Diamond' },
];

export const POLL_INTERVAL_MS = 1200;

type ConverterPhase = 'select' | 'configure' | 'converting' | 'failed';

@Component({
  selector: 'sc-converter',
  standalone: true,
  imports: [Button, FileDrop, Progress, SegmentedToggle, Slider],
  templateUrl: './converter.component.html',
  styleUrl: './converter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConverterComponent {
  readonly projectId = input.required<string>();

  private readonly conversionsApi = inject(ConversionsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly targetTypeOptions = TARGET_TYPE_OPTIONS;

  protected readonly phase = signal<ConverterPhase>('select');
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);

  protected readonly targetType = signal<PatternType>('cross_stitch');
  protected readonly width = signal(60);
  protected readonly height = signal(60);
  protected readonly colorCount = signal(24);

  protected readonly progress = signal(0);
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  onFilesSelected(files: File[]): void {
    const file = files[0];
    if (!file) return;
    this.revokePreview();
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.phase.set('configure');
  }

  reset(): void {
    this.revokePreview();
    this.selectedFile.set(null);
    this.progress.set(0);
    this.errorMessage.set('');
    this.phase.set('select');
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.previewUrl.set(null);
    }
  }

  startConversion(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.phase.set('converting');
    this.progress.set(0);
    this.statusMessage.set('Uploading…');

    this.conversionsApi
      .create(this.projectId(), file, {
        targetType: this.targetType(),
        width: this.width(),
        height: this.height(),
        colorCount: this.colorCount(),
      })
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
            this.router.navigate(['/editor', job.resultPatternId]);
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
