import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

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

  it('sizes fuse beads by bead size and shows how many pegboards they need', () => {
    fixture.componentRef.setInput('type', 'fuse_bead');
    fixture.componentRef.setInput('width', 58);
    fixture.componentRef.setInput('height', 30);
    fixture.componentRef.setInput('unitSize', 5);
    fixture.componentRef.setInput('boardPegs', 29);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('58 × 30 beads');
    expect(text).toContain('29.0 × 15.0 cm');
    expect(text).toContain('5mm beads');
    expect(text).toContain('2 × 2 boards of 29 × 29 pegs');
  });

  it('shows no board count for other crafts', () => {
    fixture.componentRef.setInput('type', 'diamond');
    fixture.componentRef.setInput('width', 58);
    fixture.componentRef.setInput('height', 30);
    fixture.componentRef.setInput('unitSize', 2.5);
    fixture.componentRef.setInput('boardPegs', 29);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('board');
    expect(fixture.nativeElement.textContent).toContain('58 × 30 drills');
  });
});
