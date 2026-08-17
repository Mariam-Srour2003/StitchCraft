import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SizeReadout } from './size-readout';

describe('SizeReadout', () => {
  let fixture: ComponentFixture<SizeReadout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SizeReadout] }).compileComponents();
    fixture = TestBed.createComponent(SizeReadout);
  });

  it('shows the grid dimensions in stitches', () => {
    fixture.componentRef.setInput('type', 'cross_stitch');
    fixture.componentRef.setInput('width', 140);
    fixture.componentRef.setInput('height', 100);
    fixture.componentRef.setInput('unitSize', 14);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('140 × 100 stitches');
  });

  it('shows finished physical size and the Aida count label for cross-stitch', () => {
    fixture.componentRef.setInput('type', 'cross_stitch');
    fixture.componentRef.setInput('width', 140);
    fixture.componentRef.setInput('height', 140);
    fixture.componentRef.setInput('unitSize', 14);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('10.0"');
    expect(text).toContain('14-count Aida');
  });

  it('shows the drill-size label for diamond patterns', () => {
    fixture.componentRef.setInput('type', 'diamond');
    fixture.componentRef.setInput('width', 100);
    fixture.componentRef.setInput('height', 100);
    fixture.componentRef.setInput('unitSize', 2.5);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2.5mm drills');
  });
});
