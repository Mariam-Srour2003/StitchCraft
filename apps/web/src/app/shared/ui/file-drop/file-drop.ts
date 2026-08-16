import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'sc-file-drop',
  standalone: true,
  templateUrl: './file-drop.html',
  styleUrl: './file-drop.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileDrop {
  readonly accept = input('image/png,image/jpeg,image/webp');
  readonly hint = input('PNG, JPG, or WebP');
  readonly filesSelected = output<File[]>();

  protected readonly isDragOver = signal(false);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  openPicker(): void {
    this.inputRef().nativeElement.click();
  }

  onInputChange(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    this.emitFiles(files);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    this.emitFiles(event.dataTransfer?.files ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  private emitFiles(files: FileList | null): void {
    if (files && files.length > 0) {
      this.filesSelected.emit(Array.from(files));
    }
  }
}
