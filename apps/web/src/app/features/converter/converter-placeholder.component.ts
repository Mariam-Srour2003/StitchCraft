import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

/** The image-to-pattern converter wizard ships in milestone M2 (see PLAN.md). */
@Component({
  selector: 'sc-converter-placeholder',
  standalone: true,
  imports: [EmptyState],
  template: `
    <sc-empty-state
      title="Image conversion is coming in M2"
      description="Upload a photo, reduce it to a color palette, and generate an editable chart."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConverterPlaceholderComponent {}
