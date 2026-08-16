import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'sc-toolbar',
  standalone: true,
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toolbar {
  readonly ariaLabel = input('Toolbar');
}
