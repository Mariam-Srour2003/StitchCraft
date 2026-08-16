import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'sc-icon-button',
  standalone: true,
  templateUrl: './icon-button.html',
  styleUrl: './icon-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconButton {
  /** Required: icon-only buttons must have an accessible name. */
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly toggled = input(false);
  readonly pressed = output<void>();

  onClick(): void {
    if (!this.disabled()) this.pressed.emit();
  }
}
