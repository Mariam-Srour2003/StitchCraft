import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { findDmcByCode } from '@stitchcraft/color';
import { AuthStore } from '@app/core/auth/auth.store';
import { PalettesApiService } from '@app/data-access/palettes-api.service';
import { StashComponent } from './stash.component';

describe('StashComponent', () => {
  const setup = async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [StashComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: { currentUser: signal({ id: 'u1' }), isAuthenticated: signal(true) },
        },
        { provide: PalettesApiService, useValue: { searchDmc: jest.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(StashComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('adds threads from search and lists them', async () => {
    const fixture = await setup();
    fixture.componentInstance.addThread(findDmcByCode('310')!);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Black');
  });

  it('imports a pasted list and reports unknown codes', async () => {
    const fixture = await setup();
    fixture.componentInstance['importText'].set('321 x2, zzz');
    fixture.componentInstance.runImport();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Added 1.');
    expect(text).toContain('zzz');
    expect(text).toContain('Red');
  });

  it('filters by code or name', async () => {
    const fixture = await setup();
    fixture.componentInstance.addThread(findDmcByCode('310')!);
    fixture.componentInstance.addThread(findDmcByCode('321')!);
    fixture.componentInstance['filter'].set('red');
    expect(fixture.componentInstance['visible']().map((i) => i.color.code)).toEqual(['321']);
  });
});
