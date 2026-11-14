import type { CanDeactivateFn } from '@angular/router';

/** Anything that can veto navigating away, e.g. an editor with unsaved changes. */
export interface LeaveGuarded {
  canLeave(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<LeaveGuarded> = (component) =>
  component?.canLeave ? component.canLeave() : true;
