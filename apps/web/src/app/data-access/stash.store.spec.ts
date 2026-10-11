import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '@app/core/auth/auth.store';

import { compareDmcCodes, parseThreadList,StashStore } from './stash.store';

describe('parseThreadList', () => {
  it('reads codes with optional quantities in several formats', () => {
    expect(parseThreadList('310, 321 x2\n666:3; B5200 1.5\nwhite')).toEqual([
      { code: '310', skeins: 1 },
      { code: '321', skeins: 2 },
      { code: '666', skeins: 3 },
      { code: 'B5200', skeins: 1.5 },
      { code: 'white', skeins: 1 },
    ]);
  });
});

describe('compareDmcCodes', () => {
  it('sorts numerically, then named codes', () => {
    expect(['White', '3865', '310', 'B5200', '26'].sort(compareDmcCodes)).toEqual([
      '26',
      '310',
      '3865',
      'B5200',
      'White',
    ]);
  });
});

describe('StashStore', () => {
  const user = signal<{ id: string } | null>({ id: 'u1' });

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthStore, useValue: { currentUser: user } }],
    });
    const store = TestBed.inject(StashStore);
    TestBed.flushEffects();
    return store;
  };

  beforeEach(() => {
    localStorage.clear();
    user.set({ id: 'u1' });
  });

  it('adds threads, accumulates skeins and persists per user', () => {
    const store = create();
    expect(store.add('310')).toBe(true);
    store.add('310', 2);
    expect(store.quantity('310')).toBe(3);
    expect(create().quantity('310')).toBe(3);

    user.set({ id: 'u2' });
    expect(create().quantity('310')).toBe(0);
  });

  it('rejects unknown codes and normalizes case', () => {
    const store = create();
    expect(store.add('99999')).toBe(false);
    expect(store.add('white')).toBe(true);
    expect(store.codes()).toEqual(['White']);
  });

  it('imports a pasted list and reports unknown codes', () => {
    const store = create();
    const result = store.importText('310 x2, 321, nope');
    expect(result).toEqual({ added: 2, unknown: ['nope'] });
    expect(store.totalSkeins()).toBe(3);
  });

  it('sets, removes and exports CSV', () => {
    const store = create();
    store.set('321', 1.3); // rounds to the nearest half skein
    expect(store.quantity('321')).toBe(1.5);
    expect(store.toCsv()).toContain('321,"Red",');
    store.remove('321');
    expect(store.items()).toEqual([]);
  });
});
