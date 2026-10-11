import type { ComponentFixture } from '@angular/core/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import type { DmcColor, PaginatedResponse } from '@stitchcraft/types';
import { Subject, of, throwError } from 'rxjs';
import { PalettesApiService } from '@app/data-access/palettes-api.service';
import { DMC_SEARCH_DEBOUNCE_MS, DmcThreadSearchComponent } from './dmc-thread-search.component';

const black: DmcColor = {
  code: '310',
  name: 'Black',
  hex: '#000000',
  rgb: { r: 0, g: 0, b: 0 },
  lab: { l: 0, a: 0, b: 0 },
};
const salmon: DmcColor = {
  code: '760',
  name: 'Salmon',
  hex: '#F5ADAD',
  rgb: { r: 245, g: 173, b: 173 },
  lab: { l: 77, a: 25, b: 9 },
};

function page(items: DmcColor[], total = items.length): PaginatedResponse<DmcColor> {
  return { items, total, page: 1, pageSize: 24 };
}

describe('DmcThreadSearchComponent', () => {
  let fixture: ComponentFixture<DmcThreadSearchComponent>;
  let component: DmcThreadSearchComponent;
  let api: { searchDmc: jest.Mock };

  beforeEach(async () => {
    api = { searchDmc: jest.fn().mockReturnValue(of(page([black]))) };
    await TestBed.configureTestingModule({
      imports: [DmcThreadSearchComponent],
      providers: [{ provide: PalettesApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(DmcThreadSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const text = () => fixture.nativeElement.textContent as string;

  it('does not query until something is typed', () => {
    expect(api.searchDmc).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.dmc-search__result')).toHaveLength(0);
  });

  it('debounces typing into a single trimmed query', fakeAsync(() => {
    component.onTermInput('3');
    component.onTermInput('31');
    component.onTermInput(' 310 ');
    tick(DMC_SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();

    expect(api.searchDmc).toHaveBeenCalledTimes(1);
    expect(api.searchDmc).toHaveBeenCalledWith('310', 1, 24);
    expect(text()).toContain('Black');
  }));

  it('ignores a stale response that arrives after a newer search', fakeAsync(() => {
    const slow = new Subject<PaginatedResponse<DmcColor>>();
    api.searchDmc.mockReturnValueOnce(slow).mockReturnValueOnce(of(page([salmon])));

    component.onTermInput('black');
    tick(DMC_SEARCH_DEBOUNCE_MS);
    component.onTermInput('salmon');
    tick(DMC_SEARCH_DEBOUNCE_MS);
    slow.next(page([black]));
    fixture.detectChanges();

    expect(text()).toContain('Salmon');
    expect(text()).not.toContain('Black');
  }));

  it('emits threadSelected when a result is clicked', fakeAsync(() => {
    const spy = jest.fn();
    component.threadSelected.subscribe(spy);
    component.onTermInput('310');
    tick(DMC_SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.dmc-search__result').click();
    expect(spy).toHaveBeenCalledWith(black);
  }));

  it('marks threads that are already in the palette', fakeAsync(() => {
    fixture.componentRef.setInput('paletteCodes', ['310']);
    component.onTermInput('310');
    tick(DMC_SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();

    expect(text()).toContain('In palette');
  }));

  it('shows an empty-state message when nothing matches', fakeAsync(() => {
    api.searchDmc.mockReturnValueOnce(of(page([])));
    component.onTermInput('zzz');
    tick(DMC_SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();

    expect(text()).toContain('No DMC threads match "zzz"');
  }));

  it('shows an error and keeps working after a failed request', fakeAsync(() => {
    api.searchDmc.mockReturnValueOnce(throwError(() => new Error('down')));
    component.onTermInput('310');
    tick(DMC_SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    expect(text()).toContain("Couldn't search threads");

    component.onTermInput('760');
    tick(DMC_SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    expect(api.searchDmc).toHaveBeenLastCalledWith('760', 1, 24);
  }));
});
