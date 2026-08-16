import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { hexToRgb } from '@stitchcraft/color';
import { CustomColor } from '@stitchcraft/types';
import { Button } from '../button/button';

@Component({
  selector: 'sc-color-picker',
  standalone: true,
  imports: [FormsModule, Button],
  templateUrl: './color-picker.html',
  styleUrl: './color-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorPicker {
  readonly colorAdded = output<CustomColor>();

  protected readonly hex = signal('#a8433a');
  protected readonly label = signal('');

  addToPalette(): void {
    const trimmedLabel = this.label().trim();
    this.colorAdded.emit({
      hex: this.hex(),
      rgb: hexToRgb(this.hex()),
      ...(trimmedLabel && { label: trimmedLabel }),
    });
    this.label.set('');
  }
}
