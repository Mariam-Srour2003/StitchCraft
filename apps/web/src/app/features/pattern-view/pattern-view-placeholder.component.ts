import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

/** The read-only chart viewer / printable export view ships in milestone M1 (see PLAN.md). */
@Component({
  selector: 'sc-pattern-view-placeholder',
  standalone: true,
  imports: [EmptyState],
  template: `
    <sc-empty-state
      title="Pattern viewing is coming in M1"
      description="A read-only chart viewer alongside the full editor lands in the next milestone."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatternViewPlaceholderComponent {}
