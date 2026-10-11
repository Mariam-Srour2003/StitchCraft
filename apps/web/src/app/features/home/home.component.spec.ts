import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Pattern } from '@stitchcraft/types';
import { encodeGrid } from '@stitchcraft/types';

import { AuthStore } from '@app/core/auth/auth.store';
import { PatternLibraryService } from '@app/data-access/pattern-library.service';

import { HomeComponent } from './home.component';

function pattern(id: string, progressRow: (number | null)[]): Pattern {
  return {
    id,
    projectId: 'proj',
    name: `Pattern ${id}`,
    type: 'cross_stitch',
    width: 2,
    height: 1,
    palette: [{ index: 0, symbol: 'A', color: { hex: '#000000', rgb: { r: 0, g: 0, b: 0 } } }],
    grid: encodeGrid([[0, 0]]),
    meta: { createdFrom: 'blank', progress: encodeGrid([progressRow]) },
    createdAt: '',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('HomeComponent', () => {
  const setup = async (authenticated: boolean) => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    const loadAll = jest.fn().mockResolvedValue({
      projects: [{ id: 'proj', name: 'Gifts', patternIds: ['a', 'b'] }],
      patterns: [
        { project: { id: 'proj', name: 'Gifts' }, pattern: pattern('a', [1, null]) },
        { project: { id: 'proj', name: 'Gifts' }, pattern: pattern('b', [null, null]) },
      ],
    });
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: signal(authenticated),
            currentUser: signal(authenticated ? { name: 'Mariam' } : null),
          },
        },
        { provide: PatternLibraryService, useValue: { loadAll } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, loadAll };
  };

  it('shows the landing page to signed-out visitors without loading data', async () => {
    const { fixture, loadAll } = await setup(false);
    expect(fixture.nativeElement.textContent).toContain('Design it, chart it, stitch it.');
    expect(loadAll).not.toHaveBeenCalled();
  });

  it('shows stats, in-progress and recent patterns when signed in', async () => {
    const { fixture } = await setup(true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Welcome back, Mariam');
    expect(text).toContain('Continue stitching');
    expect(text).toContain('Pattern a');
    expect(text).toContain('Stitches done of 4');
    expect(text).toContain('Recent patterns');
  });
});
