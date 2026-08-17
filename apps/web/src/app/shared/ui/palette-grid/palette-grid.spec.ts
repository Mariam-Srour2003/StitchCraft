import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { PaletteEntry } from '@stitchcraft/types';
import { PaletteGrid } from './palette-grid';
import { PaletteSwatch } from '../palette-swatch/palette-swatch';

describe('PaletteGrid', () => {
  let fixture: ComponentFixture<PaletteGrid>;

  const entries: PaletteEntry[] = [
    { index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } },
    { index: 1, symbol: 'B', color: { hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } } },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PaletteGrid] }).compileComponents();
    fixture = TestBed.createComponent(PaletteGrid);
  });

  it('shows an empty-state message when there are no entries', () => {
    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No colors yet');
  });

  it('renders one swatch per entry', () => {
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.directive(PaletteSwatch))).toHaveLength(2);
  });

  it('marks the swatch matching selectedIndex as selected', () => {
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('selectedIndex', 1);
    fixture.detectChanges();

    const swatches = fixture.debugElement.queryAll(By.directive(PaletteSwatch));
    expect(swatches[0].componentInstance.selected()).toBe(false);
    expect(swatches[1].componentInstance.selected()).toBe(true);
  });

  it('emits selectIndex with the entry index when a swatch is pressed', () => {
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();
    const spy = jest.fn();
    fixture.componentInstance.selectIndex.subscribe(spy);

    fixture.debugElement.queryAll(By.directive(PaletteSwatch))[1].componentInstance.pressed.emit();

    expect(spy).toHaveBeenCalledWith(1);
  });
});
