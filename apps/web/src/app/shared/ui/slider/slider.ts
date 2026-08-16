import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'sc-slider',
  standalone: true,
  templateUrl: './slider.html',
  styleUrl: './slider.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Slider {
  readonly label = input.required<string>();
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  readonly value = input.required<number>();
  readonly valueChange = output<number>();

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.valueChange.emit(Number(target.value));
  }
}
