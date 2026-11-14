import { TestBed } from '@angular/core/testing';

import { DEFAULT_SETTINGS, SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  beforeEach(() => localStorage.clear());

  const create = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(SettingsStore);
  };

  it('starts from defaults', () => {
    expect(create().settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists updates across instances', () => {
    create().update({ fabricCount: 18, strands: 1 });
    const again = create();
    expect(again.fabricCount()).toBe(18);
    expect(again.strands()).toBe(1);
  });

  it('maps "auto" strands to undefined for estimators', () => {
    expect(create().strands()).toBeUndefined();
  });

  it('clamps and repairs bad values', () => {
    const store = create();
    store.update({ fabricCount: 999, stitchesPerHour: -5 });
    expect(store.fabricCount()).toBe(40);
    expect(store.stitchesPerHour()).toBe(1);
  });

  it('survives corrupt stored JSON', () => {
    localStorage.setItem('stitchcraft.settings.v1', '{not json');
    expect(create().settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('resets to defaults', () => {
    const store = create();
    store.update({ canvasTheme: 'dark' });
    store.reset();
    expect(store.canvasTheme()).toBe('auto');
  });
});
