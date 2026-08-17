import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'sc-modal',
  standalone: true,
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal implements AfterViewInit {
  readonly heading = input.required<string>();
  readonly closed = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLElement>>('dialog');

  ngAfterViewInit(): void {
    // Moves focus into the dialog so Escape (bound below) is reachable via
    // keydown bubbling regardless of what had focus before the modal opened -
    // required by the WAI-ARIA dialog pattern, not just for the linter.
    this.dialogRef().nativeElement.focus();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef().nativeElement) {
      this.close();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
