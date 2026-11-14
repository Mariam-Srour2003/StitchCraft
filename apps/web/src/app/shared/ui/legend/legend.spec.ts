import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { LegendRow } from './legend';
import { Legend } from './legend';

describe('Legend', () => {
  let fixture: ComponentFixture<Legend>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Legend] }).compileComponents();
    fixture = TestBed.createComponent(Legend);
  });

  it('shows an empty message with no rows', () => {
    fixture.componentRef.setInput('rows', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No stitches placed yet');
  });

  it('renders a row per palette entry with its symbol, label, and count', () => {
    const rows: LegendRow[] = [
      {
        entry: {
          index: 0,
          symbol: 'A',
          color: {
            code: '310',
            name: 'Black',
            hex: '#000000',
            rgb: { r: 0, g: 0, b: 0 },
            lab: { l: 0, a: 0, b: 0 },
          },
        },
        count: 42,
      },
    ];
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('A');
    expect(text).toContain('DMC 310 — Black');
    expect(text).toContain('42');
  });

  it('falls back to a custom color label when not a DMC color', () => {
    const rows: LegendRow[] = [
      {
        entry: {
          index: 0,
          symbol: 'Z',
          color: { hex: '#123456', rgb: { r: 18, g: 52, b: 86 }, label: 'Sky' },
        },
        count: 3,
      },
    ];
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sky');
  });

  it('defaults the count column header to "Stitches"', () => {
    fixture.componentRef.setInput('rows', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('thead').textContent).toContain('Stitches');
  });

  it('shows a custom count label for diamond patterns ("Drills")', () => {
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('countLabel', 'Drills');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('thead').textContent).toContain('Drills');
  });

  describe('optional columns and selection', () => {
    const entry = {
      index: 0,
      symbol: 'A',
      color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } },
    };

    it('shows a buy column and a progress column when enabled', () => {
      fixture.componentRef.setInput('rows', [{ entry, count: 10, buy: 2, done: 4 }]);
      fixture.componentRef.setInput('buyLabel', 'Skeins');
      fixture.componentRef.setInput('showProgress', true);
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Skeins');
      expect(text).toContain('Done');
      expect(text).toContain('40%');
    });

    it('hides the optional columns by default', () => {
      fixture.componentRef.setInput('rows', [{ entry, count: 10, buy: 2 }]);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Skeins');
      expect(fixture.nativeElement.querySelectorAll('th')).toHaveLength(3);
    });

    it('emits rowSelected with the palette index when a row is clicked', () => {
      const spy = jest.fn();
      fixture.componentInstance.rowSelected.subscribe(spy);
      fixture.componentRef.setInput('rows', [{ entry, count: 1 }]);
      fixture.detectChanges();
      fixture.nativeElement.querySelector('.sc-legend__row').click();
      expect(spy).toHaveBeenCalledWith(0);
    });

    it('marks the highlighted row', () => {
      fixture.componentRef.setInput('rows', [{ entry, count: 1 }]);
      fixture.componentRef.setInput('highlightedIndex', 0);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.sc-legend__row--highlighted')).not.toBeNull();
    });
  });
});
