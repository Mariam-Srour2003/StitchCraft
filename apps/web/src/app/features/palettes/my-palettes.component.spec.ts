import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Palette } from '@stitchcraft/types';
import { of } from 'rxjs';
import { MyPalettesComponent } from './my-palettes.component';
import { PalettesApiService } from './palettes-api.service';

const savedPalette: Palette = {
  id: 'pal-1',
  ownerId: 'user-1',
  kind: 'custom',
  name: 'Sunset',
  entries: [{ index: 0, symbol: 'A', color: { hex: '#FF8800', rgb: { r: 255, g: 136, b: 0 } } }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('MyPalettesComponent', () => {
  let fixture: ComponentFixture<MyPalettesComponent>;
  let api: { list: jest.Mock; create: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    api = { list: jest.fn().mockReturnValue(of([])), create: jest.fn(), remove: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [MyPalettesComponent],
      providers: [{ provide: PalettesApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(MyPalettesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows an empty state with no saved palettes', () => {
    expect(fixture.nativeElement.textContent).toContain('No custom palettes yet');
  });

  it('lists saved palettes once loaded', async () => {
    api.list.mockReturnValueOnce(of([savedPalette]));
    await fixture.componentInstance.refresh();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sunset');
  });

  it('builds up entries locally as colors are added, assigning increasing symbols', () => {
    fixture.componentInstance.openCreate();
    fixture.componentInstance.addColor({ hex: '#111111', rgb: { r: 17, g: 17, b: 17 } });
    fixture.componentInstance.addColor({ hex: '#222222', rgb: { r: 34, g: 34, b: 34 } });

    const entries = fixture.componentInstance['newEntries']();
    expect(entries).toHaveLength(2);
    expect(entries[0].index).toBe(0);
    expect(entries[1].index).toBe(1);
    expect(entries[0].symbol).not.toBe(entries[1].symbol);
  });

  it('removing a color re-indexes the remaining entries contiguously', () => {
    fixture.componentInstance.openCreate();
    fixture.componentInstance.addColor({ hex: '#111111', rgb: { r: 17, g: 17, b: 17 } });
    fixture.componentInstance.addColor({ hex: '#222222', rgb: { r: 34, g: 34, b: 34 } });
    fixture.componentInstance.addColor({ hex: '#333333', rgb: { r: 51, g: 51, b: 51 } });

    fixture.componentInstance.removeColorAt(1); // remove the middle one

    const entries = fixture.componentInstance['newEntries']();
    expect(entries.map((e) => e.color.hex)).toEqual(['#111111', '#333333']);
    expect(entries.map((e) => e.index)).toEqual([0, 1]);
  });

  it('does not save an empty palette', async () => {
    fixture.componentInstance.openCreate();
    await fixture.componentInstance.savePalette();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('saves the palette with name and entries, then closes and refreshes', async () => {
    api.create.mockReturnValueOnce(of(savedPalette));
    fixture.componentInstance.openCreate();
    fixture.componentInstance.setName('Sunset');
    fixture.componentInstance.addColor({ hex: '#FF8800', rgb: { r: 255, g: 136, b: 0 } });

    await fixture.componentInstance.savePalette();

    expect(api.create).toHaveBeenCalledWith({
      name: 'Sunset',
      entries: [
        { color: { hex: '#FF8800', rgb: { r: 255, g: 136, b: 0 } }, symbol: expect.any(String) },
      ],
    });
    expect(fixture.componentInstance['creating']()).toBe(false);
  });

  it('deletes a palette and refreshes the list', async () => {
    // The constructor already triggered one refresh() call during
    // fixture creation (in beforeEach); deletePalette() should trigger
    // exactly one more, not replace or skip it.
    const callsBeforeDelete = api.list.mock.calls.length;
    api.list.mockReturnValueOnce(of([]));
    api.remove.mockReturnValueOnce(of(undefined));

    await fixture.componentInstance.deletePalette('pal-1');

    expect(api.remove).toHaveBeenCalledWith('pal-1');
    expect(api.list).toHaveBeenCalledTimes(callsBeforeDelete + 1);
  });
});
