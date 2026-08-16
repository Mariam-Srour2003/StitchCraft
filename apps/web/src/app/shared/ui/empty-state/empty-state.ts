import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'sc-empty-state',
  standalone: true,
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
