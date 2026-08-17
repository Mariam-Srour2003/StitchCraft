import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Badge } from './badge';

describe('Badge', () => {
  let fixture: ComponentFixture<Badge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Badge] }).compileComponents();
    fixture = TestBed.createComponent(Badge);
    fixture.detectChanges();
  });

  it('defaults to the neutral tone', () => {
    expect(fixture.nativeElement.querySelector('.sc-badge').className).toContain(
      'sc-badge--neutral',
    );
  });

  it('reflects the tone input', () => {
    fixture.componentRef.setInput('tone', 'danger');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sc-badge').className).toContain(
      'sc-badge--danger',
    );
  });
});
