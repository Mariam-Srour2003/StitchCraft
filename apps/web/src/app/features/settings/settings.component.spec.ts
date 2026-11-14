import { TestBed } from '@angular/core/testing';

import { SettingsStore } from '@app/core/settings/settings.store';

import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  beforeEach(() => localStorage.clear());

  it('updates numeric and text settings through the store', async () => {
    await TestBed.configureTestingModule({ imports: [SettingsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const store = TestBed.inject(SettingsStore);

    fixture.componentInstance.set('fabricCount', '18');
    fixture.componentInstance.set('strands', 'auto');
    fixture.componentInstance.set('canvasTheme', 'dark');
    fixture.componentInstance.set('stitchesPerHour', '120');

    expect(store.fabricCount()).toBe(18);
    expect(store.strands()).toBeUndefined();
    expect(store.canvasTheme()).toBe('dark');
    expect(store.stitchesPerHour()).toBe(120);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Saved.');
  });
});
