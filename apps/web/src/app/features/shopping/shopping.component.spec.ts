import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { findDmcByCode } from '@stitchcraft/color';
import type { Pattern } from '@stitchcraft/types';
import { encodeGrid } from '@stitchcraft/types';
import { AuthStore } from '@app/core/auth/auth.store';
import { PatternLibraryService } from '@app/data-access/pattern-library.service';
import { StashStore } from '@app/data-access/stash.store';
import { ShoppingComponent } from './shopping.component';

function pattern(id: string, row: (number | null)[], done = false): Pattern {
  return {
    id,
    projectId: 'p',
    name: `Pattern ${id}`,
    type: 'cross_stitch',
    width: row.length,
    height: 1,
    palette: [
      { index: 0, symbol: 'A', color: findDmcByCode('310')! },
      { index: 1, symbol: 'B', color: findDmcByCode('321')! },
    ],
    grid: encodeGrid([row]),
    meta: {
      createdFrom: 'blank',
      fabricCount: 14,
      ...(done ? { progress: encodeGrid([row.map((v) => (v === null ? null : 1))]) } : {}),
    },
    createdAt: '',
    updatedAt: '',
  };
}

describe('ShoppingComponent', () => {
  const setup = async () => {
    localStorage.clear();
    const project = { id: 'p', name: 'Proj', patternIds: [] };
    await TestBed.configureTestingModule({
      imports: [ShoppingComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { currentUser: signal({ id: 'u1' }) } },
        {
          provide: PatternLibraryService,
          useValue: {
            loadAll: jest.fn().mockResolvedValue({
              projects: [project],
              patterns: [
                { project, pattern: pattern('a', [0, 1]) },
                { project, pattern: pattern('done', [1], true) },
              ],
            }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ShoppingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('preselects unfinished patterns and lists what to buy', async () => {
    const fixture = await setup();
    const selected = fixture.componentInstance['selected']();
    expect(selected.has('a')).toBe(true);
    expect(selected.has('done')).toBe(false);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('DMC 310');
    expect(text).toContain('DMC 321');
  });

  it('hides threads covered by the stash', async () => {
    const fixture = await setup();
    TestBed.inject(StashStore).add('310', 3);
    fixture.detectChanges();
    const keys = fixture.componentInstance['threadLines']().map((l) => l.key);
    expect(keys).toEqual(['321']);
    expect(fixture.componentInstance['totals']().covered).toBe(1);
  });

  it('moves bought threads into the stash', async () => {
    const fixture = await setup();
    fixture.componentInstance.toggleBought('321');
    fixture.componentInstance.moveBoughtToStash();
    expect(TestBed.inject(StashStore).quantity('321')).toBe(1);
    expect(fixture.componentInstance['bought']().size).toBe(0);
  });

  it('can select all or none', async () => {
    const fixture = await setup();
    fixture.componentInstance.selectAll(false);
    expect(fixture.componentInstance['list']().threads).toEqual([]);
    fixture.componentInstance.selectAll(true);
    expect(fixture.componentInstance['selected']().size).toBe(2);
  });
});
