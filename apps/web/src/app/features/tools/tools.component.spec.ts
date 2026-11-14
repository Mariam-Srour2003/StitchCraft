import { TestBed } from '@angular/core/testing';

import { ToolsComponent } from './tools.component';

describe('ToolsComponent', () => {
  beforeEach(() => localStorage.clear());

  it('shows live results from the default inputs and recomputes on change', async () => {
    await TestBed.configureTestingModule({ imports: [ToolsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ToolsComponent);
    fixture.detectChanges();
    const text = () => fixture.nativeElement.textContent as string;
    expect(text()).toContain('6 × 5 in');
    expect(text()).toContain('12 × 11 in');

    fixture.componentInstance['width'].set(140);
    fixture.componentInstance['height'].set(140);
    fixture.detectChanges();
    expect(text()).toContain('10 × 10 in');
  });

  it('tolerates empty number fields while typing', async () => {
    await TestBed.configureTestingModule({ imports: [ToolsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ToolsComponent);
    fixture.componentInstance['count'].set(null as unknown as number);
    fixture.componentInstance['stitches'].set(null as unknown as number);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance['size']().designWidthIn).toBe(6);
  });
});
