import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Progress } from './progress';

describe('Progress', () => {
  let fixture: ComponentFixture<Progress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Progress] }).compileComponents();
    fixture = TestBed.createComponent(Progress);
  });

  function bar(): HTMLElement {
    return fixture.debugElement.query(By.css('[role="progressbar"]')).nativeElement;
  }

  it('reflects the value via aria-valuenow', () => {
    fixture.componentRef.setInput('value', 42);
    fixture.detectChanges();
    expect(bar().getAttribute('aria-valuenow')).toBe('42');
  });

  it('clamps values above 100', () => {
    fixture.componentRef.setInput('value', 150);
    fixture.detectChanges();
    expect(bar().getAttribute('aria-valuenow')).toBe('100');
  });

  it('clamps negative values to 0', () => {
    fixture.componentRef.setInput('value', -10);
    fixture.detectChanges();
    expect(bar().getAttribute('aria-valuenow')).toBe('0');
  });
});
