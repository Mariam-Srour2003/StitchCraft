import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { PaletteEntry } from '@stitchcraft/types';
import { PaletteSwatch } from './palette-swatch';

describe('PaletteSwatch', () => {
  let fixture: ComponentFixture<PaletteSwatch>;

  const dmcEntry: PaletteEntry = {
    index: 0,
    symbol: 'A',
    color: {
      code: '310',
      name: 'Black',
      hex: '#000000',
      rgb: { r: 0, g: 0, b: 0 },
      lab: { l: 0, a: 0, b: 0 },
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PaletteSwatch] }).compileComponents();
    fixture = TestBed.createComponent(PaletteSwatch);
    fixture.componentRef.setInput('entry', dmcEntry);
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button')).nativeElement;
  }

  it('renders the symbol and fills the swatch with the color hex', () => {
    const btn = button();
    expect(btn.textContent?.trim()).toBe('A');
    expect(btn.style.background).toContain('rgb(0, 0, 0)');
  });

  it('shows the DMC code and name as a tooltip for a DMC color', () => {
    expect(button().title).toBe('DMC 310 — Black');
  });

  it('shows a custom label (or hex) as the tooltip for a custom color', () => {
    fixture.componentRef.setInput('entry', {
      index: 1,
      symbol: 'B',
      color: { hex: '#123456', rgb: { r: 18, g: 52, b: 86 }, label: 'Sky accent' },
    } as PaletteEntry);
    fixture.detectChanges();
    expect(button().title).toBe('Sky accent');
  });

  it('reflects selection via aria-pressed', () => {
    expect(button().getAttribute('aria-pressed')).toBe('false');
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('emits pressed on click', () => {
    const spy = jest.fn();
    fixture.componentInstance.pressed.subscribe(spy);
    button().click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('picks a light glyph color against a dark swatch and a dark glyph against a light swatch', () => {
    expect(fixture.componentInstance['glyphColor']()).toBe('#ffffff');

    fixture.componentRef.setInput('entry', {
      index: 2,
      symbol: 'C',
      color: { hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, label: 'White' },
    } as PaletteEntry);
    fixture.detectChanges();
    expect(fixture.componentInstance['glyphColor']()).toBe('#000000');
  });
});
