import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { findBeadCatalogue } from '@hobbygrid/color';
import type { BeadCatalogue, DmcColor } from '@hobbygrid/types';

import { BeadColorSearchComponent } from './bead-color-search.component';

describe('BeadColorSearchComponent', () => {
  let fixture: ComponentFixture<BeadColorSearchComponent>;
  const hama = findBeadCatalogue('hama-midi') as BeadCatalogue;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BeadColorSearchComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BeadColorSearchComponent);
    fixture.componentRef.setInput('catalogue', hama);
    fixture.detectChanges();
  });

  const buttons = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

  function type(value: string): void {
    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('lists the bead line in order before anything is typed', () => {
    expect(buttons()).toHaveLength(24);
    expect(buttons()[0].textContent).toContain('H01');
    expect(fixture.nativeElement.textContent).toContain('Showing 24 of 92');
  });

  it('filters by code or name without asking the server', () => {
    type('black');
    expect(buttons().map((b) => b.textContent)).toEqual([expect.stringContaining('Black')]);
    type('h03');
    expect(buttons()[0].textContent).toContain('Yellow');
  });

  it('says so when nothing matches', () => {
    type('zzz');
    expect(fixture.nativeElement.textContent).toContain('No Hama Midi colours match "zzz"');
  });

  it('emits the colour when clicked, and marks colours already in the palette', () => {
    const picked: DmcColor[] = [];
    fixture.componentInstance.colorSelected.subscribe((c) => picked.push(c));
    fixture.componentRef.setInput('paletteCodes', ['H01']);
    fixture.detectChanges();
    expect(buttons()[0].textContent).toContain('In palette');
    buttons()[1].click();
    expect(picked.map((c) => c.code)).toEqual(['H02']);
  });

  it('flags special finishes', () => {
    type('clear');
    expect(buttons()[0].textContent).toContain('translucent');
  });
});
