import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

/**
 * A dedicated read-only/printable chart viewer is a later polish item; for
 * now `/editor/:id` (see EditorComponent) covers both viewing and editing a
 * pattern.
 */
@Component({
  selector: 'sc-pattern-view-placeholder',
  standalone: true,
  imports: [EmptyState],
  template: `
    <sc-empty-state
      title="A dedicated read-only viewer is coming later"
      description="For now, open a pattern in the full editor to view or edit it."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatternViewPlaceholderComponent {}
