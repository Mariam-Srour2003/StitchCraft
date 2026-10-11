import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface SegmentedToggleOption<T extends string = string> {
  value: T;
  label: string;
}

@Component({
  selector: 'sc-segmented-toggle',
  standalone: true,
  templateUrl: './segmented-toggle.html',
  styleUrl: './segmented-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentedToggle<T extends string = string> {
  readonly options = input.required<SegmentedToggleOption<T>[]>();
  readonly value = input.required<T>();
  readonly ariaLabel = input('View mode');
  readonly valueChange = output<T>();

  /**
   * False when `value` matches none of the options (e.g. when two toggles
   * split one setting between them); the first option then takes the tab
   * stop so the group stays keyboard-reachable.
   */
  protected readonly hasSelection = computed(() =>
    this.options().some((option) => option.value === this.value()),
  );

  select(value: T): void {
    if (value !== this.value()) this.valueChange.emit(value);
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    const options = this.options();
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.select(options[(index + 1) % options.length].value);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.select(options[(index - 1 + options.length) % options.length].value);
    }
  }
}
