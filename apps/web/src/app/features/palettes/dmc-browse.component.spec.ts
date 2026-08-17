import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { DmcColor, PaginatedResponse } from '@stitchcraft/types';
import { of } from 'rxjs';
import { DmcBrowseComponent } from './dmc-browse.component';
import { PalettesApiService } from './palettes-api.service';

function makePage(items: DmcColor[], total = items.length): PaginatedResponse<DmcColor> {
  return { items, total, page: 1, pageSize: 60 };
}

const black: DmcColor = {
  code: '310',
  name: 'Black',
  hex: '#000000',
  rgb: { r: 0, g: 0, b: 0 },
  lab: { l: 0, a: 0, b: 0 },
};

describe('DmcBrowseComponent', () => {
  let fixture: ComponentFixture<DmcBrowseComponent>;
  let api: { searchDmc: jest.Mock };

  beforeEach(async () => {
    api = { searchDmc: jest.fn().mockReturnValue(of(makePage([black]))) };

    await TestBed.configureTestingModule({
      imports: [DmcBrowseComponent],
      providers: [{ provide: PalettesApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(DmcBrowseComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads and displays the first page of DMC colors on init', () => {
    expect(api.searchDmc).toHaveBeenCalledWith('', 1, 60);
    expect(fixture.nativeElement.textContent).toContain('310');
    expect(fixture.nativeElement.textContent).toContain('Black');
  });

  it('shows the total color count', () => {
    expect(fixture.nativeElement.textContent).toContain('1 color(s)');
  });

  it('re-queries with the new search term when it changes', async () => {
    api.searchDmc.mockReturnValueOnce(of(makePage([])));
    await fixture.componentInstance.onSearchChange('salmon');
    expect(api.searchDmc).toHaveBeenCalledWith('salmon', 1, 60);
  });
});
