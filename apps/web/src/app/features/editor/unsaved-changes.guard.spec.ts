import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const run = (component: { canLeave(): boolean }) =>
    unsavedChangesGuard(
      component,
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
      {} as RouterStateSnapshot,
    );

  it('asks the component whether it can be left', () => {
    expect(run({ canLeave: () => true })).toBe(true);
    expect(run({ canLeave: () => false })).toBe(false);
  });
});
