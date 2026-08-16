import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

/** The grid-canvas pattern editor ships in milestone M1 (see PLAN.md). */
@Component({
  selector: 'sc-editor-placeholder',
  standalone: true,
  imports: [EmptyState],
  template: `
    <sc-empty-state
      title="The pattern editor is coming in M1"
      description="Grid canvas, paint/erase tools, palette panel, and view modes land in the next milestone."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPlaceholderComponent {}
